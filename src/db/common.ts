import type { DBRequestedItems, DBSearchRunResult } from '../db-search';
import type { FavouriteDB } from '../favourite-db';
import { get_meta_db } from '../meta-db';
import { persistentStorage } from '../persistent-storage.es5';
import { Album, MaybeLoadedSong, NotLoadedSong, Song, SongSource } from '../song';
import { LOCALE_SORT, SORT_TITLE_SORT } from '../sort-helpers';
import { deferred_promise, type DeferredPromise } from '../util';

export type SearchMetaFilters = DBFilters;

const TIMING_STAT_LENGTH = 50; // how many samples to take into account when figuring out response time

// Languages that the user wants in their database. Stored and returned like [ en, fr, ... ]
const CHOSEN_LANGUAGES_KEY = 'chosen-languages';
export const get_db_chosen_langs = (def: string[] = []): string[] => persistentStorage.getObj<string[]>(CHOSEN_LANGUAGES_KEY, def);
export const save_db_chosen_langs = (langs: string[]) => persistentStorage.setObj(CHOSEN_LANGUAGES_KEY, langs);

export interface DBBaseFilters {
    search: string;
    order_by: string;
    lang?: string; // comma-separated list of languages
    songkey?: string;
    has_mp3?: 1 | 0;
    has_chord?: 1 | 0;
    has_sheet?: 1 | 0;
    is_original?: 1 | 0;
    favourite?: 1 | 0;
}

export interface DBFilters extends DBBaseFilters {
    advanced_tags: {
        [tag_id: number]: 1 | 0 | undefined;
    };
    source_id?: string; // comma-separated list of source ids
    album_id?: string; // comma-separated list of album ids
}

export interface _SearchMetaResult {
    albums: Album[];
    sources: SongSource[];
}

// Base class for all database implementations
export abstract class CommonDB {
    _db_initialized: DeferredPromise<void>;
    db_initialized: Promise<void>;
    _db_populated: DeferredPromise<void>;
    db_populated: Promise<void>;
    timing_stats: number[];
    avg_time: number;
    _query_validity: number;
    _type!: string;

    _instant_total_query = false; // If true then don't rely on RTT to figure out if we should do a (slower) seperate query for the total

    FAVOURITE_DB: FavouriteDB;

    abstract _search_meta(filters: SearchMetaFilters): Promise<_SearchMetaResult>;
    abstract _get_songs(ids: number[], ajax_fallback?: boolean): Promise<Song[]>;

    abstract get_song_sources(): Promise<SongSource[]>;
    abstract get_song(song_id: number, ajax_fallback?: boolean, with_dump?: boolean): Promise<Song | null>;

    abstract _run_search(query: unknown, requested_items: DBRequestedItems): Promise<DBSearchRunResult>;
    abstract _get_total(query: unknown): Promise<number>;
    abstract _prepare_query(filters: DBFilters): unknown;

    // Some databases may want to record favourite information to help with additional filtering
    async set_favourite(_song_id: number, _value: 1 | 0): Promise<void> {}

    async kill_db(): Promise<void> {}

    constructor(favourite_db: FavouriteDB) {
        // Follow the various steps of database initialization as documented below
        [this._db_initialized, this.db_initialized] = deferred_promise<void>();
        [this._db_populated, this.db_populated] = deferred_promise<void>();
        this.db_initialized.then(() => console.log('Database initialized'));
        this.db_populated.then(() => console.log('Database populated'));

        // Refresh the songs in the background if they were stale
        this.db_populated.then(() => this.refresh_languages(true));

        this.timing_stats = [];
        this.avg_time = persistentStorage.getObj<number>(this.avg_query_key(), 75);

        this._query_validity = 0;
        this.FAVOURITE_DB = favourite_db;
    }
    type(): string {
        return this._type;
    }
    full_type(): string {
        return this._type;
    }

    _invalidate_queries() {
        this._query_validity++;
    }

    // Used by the initialization page if there was an error to see if the database was half-populated or not
    async has_any_songs(): Promise<boolean> {
        return true;
    }

    // Initialization process:
    // 1. Set up table schema etc if required
    async initialize_db(): Promise<void> {
        await this._initialize_db();
        this._db_initialized.resolve();
    }
    abstract _initialize_db(): Promise<void>;
    abstract get_version_string(): string;

    db_load_errs?: string;

    // 2. Ensure the database is populated with (some at least) required languages
    // It requires that the database have a function called remove_languages() which removes a language from the database,
    // and a function called add_languages() which creates or updates the database with the given languages.
    async populate_db(in_background = false, progress_tracker?: (progress: number) => void): Promise<void> {
        // TODO: Make sure we don't get multiple of these running in parallel?
        await this.db_initialized;

        // We only need to handle database population if we are in the background (as user won't be involved) or if we
        // don't have any songs in the database
        if (in_background || progress_tracker || !(await this.has_any_songs())) await this._populate_db(in_background, progress_tracker);

        this._db_populated.resolve();
    }
    abstract _populate_db(in_background: boolean, progress_tracker?: (progress: number) => void): Promise<void>;

    // 3. Function to refresh the database languages if needed - if in background this should be resource-light,
    // otherwise it will be run in foreground with a spinner
    async refresh_languages(_background: boolean, _force?: boolean, _progress_tracker?: (progress: number) => void): Promise<void> {}

    // If the database updated or the type changed then tell any queries that
    // they are invalid
    query_validity(): string {
        return `${this.type()}-${this._query_validity}`;
    }

    avg_query_key(): string {
        return `avg-query-${this.full_type()}`;
    }

    add_timing_stat(time_ms: number): void {
        // Keep track of a moving average of how long the db queries
        // took so that we can feed this back as a debounce timeout for
        // taking user input
        this.avg_time += Math.floor((time_ms - this.avg_time) / TIMING_STAT_LENGTH);
        persistentStorage.setObj(this.avg_query_key(), this.avg_time);
        console.log(`db query took ${time_ms}ms; avg ${this.avg_time}`);
    }

    // Debounce user input as the average time of a query multiplied by a
    // factor to allow the user to input and get the results updating in a
    // reasonable manner. By default we base this on how long previous queries
    // took so we can adapt to the speed of the users' device.
    ideal_debounce(): number {
        return this.avg_time * 3;
    }

    // Albums and sources are called 'meta' and are copied into the database in order to allow relational searches
    async search_meta(filters: DBFilters): Promise<(SongSource | Album)[]> {
        try {
            const ret = await this._search_meta(filters);
            return ([] as (SongSource | Album)[]).concat(
                (ret.albums || []).sort((a, b) => SORT_TITLE_SORT(a, b) || LOCALE_SORT(a.title, b.title)).map((album) => ({ _type: 'album', ...album })),
                (ret.sources || []).sort((a, b) => SORT_TITLE_SORT(a, b) || LOCALE_SORT(a.name, b.name)).map((source) => ({ _type: 'song_source', ...source })),
            );
        } catch (e) {
            return []; // no issue if there is an error somewhere
        }
    }

    async get_tag_counts(): Promise<Record<number, number>> {
        const meta_db = await get_meta_db();
        const tag_counts: Record<number, number> = {};
        const mappings = meta_db.tag_mappings ?? {};
        for (const [id, info] of Object.entries(mappings)) {
            if (info?.count) tag_counts[Number(id)] = info.count;
        }
        return tag_counts;
    }

    async get_songs(ids: number[], include_empties: true, ajax_fallback?: boolean): Promise<MaybeLoadedSong[]>;
    async get_songs(ids: number[], include_empties?: false, ajax_fallback?: boolean): Promise<Song[]>;
    async get_songs(ids: number[], include_empties?: boolean, ajax_fallback?: boolean): Promise<Song[] | MaybeLoadedSong[]> {
        // Handle null/undefined input
        if (!ids) return [];

        // remove invalid objects
        ids = ids.filter((id) => !!id);

        if (!ids.length) return [];

        let results: Song[] = await this._get_songs(ids, ajax_fallback);
        if (!include_empties || ids.length == results.length) return results;

        // Add in any missing ids with not_loaded tag
        const id_map: Record<number, 1> = {};
        ids.forEach((id) => (id_map[id] = 1));
        results.forEach((song: Song) => delete id_map[song.id]);
        return (results as MaybeLoadedSong[]).concat(
            Object.keys(id_map).map(
                (id) =>
                    <NotLoadedSong>{
                        id: parseInt(id),
                        not_loaded: 1,
                    },
            ),
        );
    }
}
