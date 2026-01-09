import type { DBRequestedItems, DBSearchRunResult } from '../db-search';
import { DUMP_VERSION, get_db_path, get_host } from '../globals';
import { get_browser_languages } from '../langdetect.es5';
import { useAppLang } from '../langpack';
import { persistentStorage } from '../persistent-storage.es5';
import { Song, SongSource } from '../song';
import { fetch_json, generate_search_params, type AbortablePromise } from '../util';
import { CommonDB, get_db_chosen_langs, type DBFilters, type _SearchMetaResult } from './common';

type BaseQuery = {
    query: string;
    ui_lang: string;
    browser_langs: string;
    filters?: string;
    sort?: string;
    dir?: string;
};

type GridQuery = BaseQuery & {
    start?: number;
    limit?: number;
    no_total?: number;
};

// Fallback for web browsers not supporting Web SQL
export class OnlineDB extends CommonDB {
    private search_query: AbortablePromise<{ data: Song | Song[]; total?: number }> | null = null;
    private count_query: AbortablePromise<{ total: number }> | null = null;
    //song_query = null;
    _type = 'online';
    _instant_total_query = true; // Don't rely on RTT to figure out if we should do a slower total query

    async _initialize_db(): Promise<void> {}

    api_url(path: string, params?: Record<string, string | number | boolean | undefined>): string {
        let ret = get_host() + '/api/' + path;
        if (params) ret += '?' + generate_search_params(params as Record<string, string | number | boolean | undefined>);
        return ret;
    }
    get_version_string(): string {
        return 'online db';
    }

    // api is pretty slow at the moment
    ideal_debounce(): number {
        return 750;
    }

    // Initialization/population does not happen in the online database
    async _populate_db(): Promise<void> {}

    // Get some language params for api calls to better help with returning
    // stuff to app that is useful for the user
    _get_lang_details(): { ui_lang: string; browser_langs: string } {
        const { appLang } = useAppLang.getState();
        return {
            ui_lang: appLang!,
            browser_langs: get_browser_languages().join(','),
        };
    }

    async _search_meta(filters: DBFilters): Promise<_SearchMetaResult> {
        return fetch_json<_SearchMetaResult>(this.api_url('app/search_meta', { query: filters.search, lang: filters.lang, ...this._get_lang_details() }));
    }

    async get_song(id: number, _ajax_fallback?: boolean, with_dump?: boolean): Promise<Song | null> {
        /* XXX what if multiple related songs called at the same time?
        if( this.song_query )
            this.song_query.abort();
        */
        const data: Record<string, string | number | boolean | undefined> = { id };
        if (with_dump) data.include_dump = DUMP_VERSION;
        else {
            data.with_albums = 1;
            data.with_sources = 1;
        }

        type GetSongResponse = { data?: Song | Song[] };

        const ret = await fetch_json<GetSongResponse>(this.api_url('get', data));
        // Not found, emulate DB mode
        if (!ret.data) return null;
        if (Array.isArray(ret.data)) {
            return ret.data.length ? ret.data[0] : null;
        }

        return ret.data;
    }

    _prepare_query(_filters: DBFilters): BaseQuery {
        const query: BaseQuery = {
            query: _filters.search,
            ...this._get_lang_details(),
        };
        let filters: Partial<DBFilters> = { ..._filters }; // copy so we can manipulate it
        if (filters.order_by && filters.order_by != 'default') [query.sort, query.dir] = filters.order_by.split(/ /);

        delete filters.search;
        delete filters.order_by;

        if (!filters.lang) {
            const chosen_langs = get_db_chosen_langs(); // May not exist if user was bot
            if (chosen_langs) filters.lang = chosen_langs.join(',');
        }

        query.filters = JSON.stringify(filters);

        return query;
    }

    async _get_total(query: { filters: string; query: string }): Promise<number> {
        // Abort any pending query before starting a new one
        if (this.count_query) this.count_query.abort();

        // Browser langs, order by etc not required here. Enables much
        // better server-side caching in this case.
        this.count_query = fetch_json(
            this.api_url('grid', {
                filters: query.filters,
                query: query.query,
                pager_only: 1,
            }),
        );

        const ret = (await this.count_query) as { total: number };
        this.count_query = null;
        return ret.total;
    }

    async _run_search(_query: BaseQuery, pager: DBRequestedItems): Promise<DBSearchRunResult> {
        const query: GridQuery = { ..._query }; // copy so we don't modify the original
        query.start = pager.start;
        query.limit = pager.size;
        query.no_total = 1; // negative to enable the old api to work well

        // Abort any pending search before starting a new one
        if (this.search_query) this.search_query.abort();

        /* TODO
        if( is_set('setting-show-key-in-list') )
            query.list_songkey = 1;
            */

        // Save the query promise so we can abort it above
        this.search_query = fetch_json<{ data: Song | Song[]; total?: number }>(
            this.api_url('grid', query as Record<string, string | number | boolean | undefined>),
        );

        const ret = await this.search_query;
        // If only 1 result then it returns just that object rather than an array. But everything in us expects an array.
        const data = ret.data ? (Array.isArray(ret.data) ? ret.data : [ret.data]) : [];

        this.search_query = null;
        return { data, total: ret.total };
    }

    async _get_songs(ids: number[]): Promise<Song[]> {
        const ret = await fetch_json<{ data?: Song | Song[] }>(this.api_url('grid', { query: '', filters: JSON.stringify({ id: ids }) }));
        if (!ret.data) return [];
        return Array.isArray(ret.data) ? ret.data : [ret.data];
    }

    _sources_promise?: Promise<{ song_source_info: SongSource[] }>; // Need to store the promise so that multiple calls while in-flight will not cause multiple requests
    async get_song_sources(): Promise<SongSource[]> {
        if (!this._sources_promise) {
            // Cache in localStorage for a week
            const cur_obj = persistentStorage.getObj<{ song_source_info: SongSource[] }>('sourcedb');
            const lastTs = persistentStorage.getObj<number>('sourcedb-ts', 0);
            if (!cur_obj || lastTs + 7 * 24 * 60 * 60 * 1000 < Date.now()) {
                this._sources_promise = fetch_json(`${get_db_path()}.sources.json`, { cache: 'no-store' });

                this._sources_promise.then((sourcedb) => {
                    persistentStorage.setObj('sourcedb', sourcedb);
                    persistentStorage.setObj('sourcedb-ts', Date.now());
                });
            } else {
                this._sources_promise = Promise.resolve(cur_obj);
            }
        }

        const sourcedb = await this._sources_promise;
        if (!sourcedb) return [];
        return sourcedb.song_source_info.filter((source) => source.abbreviation);
    }
}
