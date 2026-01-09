import isEqual from 'lodash/isEqual';
import { Subject } from 'rxjs';
import { create } from 'zustand';
import type { CommonDB, DBBaseFilters, DBFilters } from './db/common';
import { eventSocket } from './event-socket';
import { persistentStorage } from './persistent-storage.es5';
import { Album, Song, SongSource } from './song';
import { unidecode } from './unidecode';
import { is_mobile_browser, prepare_search_string } from './util';

export type SourceFilterMap = Record<number, 0 | 1 | undefined>;
export type TagFilterMap = DBFilters['advanced_tags'];
type SearchFiltersState = DBBaseFilters;

export interface DBSearchRunResult {
    data: Song[];
    total?: number;
}

export interface DBRequestedItems {
    start: number;
    size: number;
    infinite_scroll?: boolean;
}

// Zustand store for song list state
interface SongListStore {
    items: (Song | SongSource | Album)[];
    requested_items?: DBRequestedItems;
    pager?: Pager;
    setSongList: (items: (Song | SongSource | Album)[], requested_items: DBRequestedItems, pager: Pager) => void;
    setPager: (pager: Pager) => void;
}

export const useSongListStore = create<SongListStore>((set) => ({
    items: [],
    requested_items: undefined,
    pager: undefined,
    setSongList: (items, requested_items, pager) => set({ items, requested_items, pager }),
    setPager: (pager) => set({ pager }),
}));

// Zustand store for search/filter state
interface SearchStore {
    filters: SearchFiltersState;
    tags: TagFilterMap;
    sources: SourceFilterMap;
    current_search?: DBSearch;

    setFilters: (filters: Partial<SearchFiltersState>) => void;
    updateSourceFilter: (sources: SourceFilterMap) => void;
    resetSourceFilter: () => void;
    updateTagFilter: (tags: TagFilterMap) => void;
    resetTagFilter: () => void;
    setCurrentSearch: (search: DBSearch | undefined) => void;
}

export const useSearchStore = create<SearchStore>((set) => ({
    filters: {
        order_by: persistentStorage.get('order-by') || 'default',
        lang: persistentStorage.get('filter-language') || 'all',
        search: '',
    },
    tags: {},
    sources: persistentStorage.getObj<SourceFilterMap>('source-select', {}),
    current_search: undefined,

    setFilters: (filters) => {
        set((state) => ({
            filters: { ...state.filters, ...filters },
        }));
        if (filters.lang) persistentStorage.set('filter-language', filters.lang);
        if (filters.order_by) persistentStorage.set('order-by', filters.order_by);
    },
    updateSourceFilter: (sources) =>
        set((state) => {
            const newSources: SourceFilterMap = { ...state.sources };
            Object.entries(sources).forEach(([sourceIdStr, val]) => {
                const sourceId = Number(sourceIdStr);
                if (val) newSources[sourceId] = 1;
                else delete newSources[sourceId];
            });
            persistentStorage.setObj('source-select', newSources);
            return { sources: newSources };
        }),
    resetSourceFilter: () => {
        const empty: SourceFilterMap = {};
        set({ sources: empty });
        persistentStorage.setObj('source-select', empty);
    },
    updateTagFilter: (tags) =>
        set((state) => {
            const newTags: TagFilterMap = { ...state.tags };
            Object.entries(tags).forEach(([tagIdStr, val]) => {
                const tagId = Number(tagIdStr);
                if (val !== undefined) newTags[tagId] = val;
                else delete newTags[tagId];
            });
            return { tags: newTags };
        }),
    resetTagFilter: () => set({ tags: {} }),
    setCurrentSearch: (current_search) => set({ current_search }),
}));

const send_search_event = eventSocket.add_queue('search', 100, 30 * 24 * 60 * 60);

// Return a list of filters in SQL::Abstract style. NOTE must ensure that all
// data is cloned
export function get_filters(): DBFilters {
    const state = useSearchStore.getState();

    const filters: DBFilters = {
        ...state.filters,
        advanced_tags: { ...state.tags },
    };
    if (filters.lang == 'all') delete filters.lang;

    // Handle passing key=val into the search function
    filters.search = filters.search.replace(/\b([^= ]+)=([^ ]+)/g, (_match, key: string, value: string) => {
        // TODO: Should we do type checking here?
        (filters as any)[key] = value;
        return '';
    });
    filters.search = filters.search.replace(/^\s+|\s+$/g, '');

    const sources = Object.keys(state.sources);
    if (sources.length) filters.source_id = sources.join(',');

    return filters;
}

export class Pager {
    page_size: number;
    last_start_update: number;
    start: number;
    total: number;
    min_total: number;
    last_real_start: number;
    last_end_update: number;

    constructor() {
        // TODO: Make this based on the performance stats rather than if mobile or not...
        this.page_size = is_mobile_browser() ? 20 : 50;
        this.last_start_update = this.start = 0;
        this.total = -1;
        this.min_total = -1; // the minimum that total could possibly be

        // the last time that a real pager call (as opposed to infinite scroll)
        // was used to page, to avoid overflowing the DOM we limit the amount
        // of virtual scrolls that can be done.
        this.last_real_start = 0;
        this.last_end_update = 0;
    }

    clone(): Pager {
        let p = new Pager();
        Object.assign(p, this);
        return p;
    }

    // Get details about start/size for a db query of the specified page
    get_requested_items(infinite_scroll?: boolean): DBRequestedItems {
        return {
            start: this.start,

            // pull get an extra record to see if the next page will have an
            // entry on it so we can be clever with pager calculations
            size: this.page_size + 1,

            infinite_scroll,
        };
    }

    // Move to the next/prev page as requested. Returns true if this is
    // possible (with the current information that we have), false if it is
    // definately impossible.
    change_page(direction: number, infinite_scroll = false): boolean {
        // Don't allow more than X items+1 page of infinate scroll before
        // having to do a manual page - don't want to make the DOM get
        // overloaded.
        if (infinite_scroll && this.start - this.last_real_start > 180) return false;

        const val = direction * this.page_size;

        // this.last_real_start is the start of the infinite scroll so if going
        // back we want to base on that. this.start is the last page loaded by
        // any infinite scroll so base on that if going forwards.
        let start = val < 0 ? this.last_real_start : this.start;

        // The button visibility may lag behind the database updates so if we
        // know the pager total then don't allow it to go too far
        if (this.total >= 0 && start + val >= this.total) {
            if (val > 0) return false;

            // rewind to the previous good page
            while (start >= this.total && start > 0) start += val;
        }

        if (start == 0 && val < 0)
            // don't do anything if we would go -ve
            return false;

        this.start = start + val;
        if (this.start < 0) this.start = 0;

        if (!infinite_scroll) this.last_real_start = this.start;
        return true;
    }

    // We definately know what the total count is
    set_total(total: number): void {
        this.total = total;
    }

    update(requested_items: DBRequestedItems, on_cur_page: number): void {
        // we may be calling async so our current object's start (ie the bit
        // that was last requested) may be different from the result that this
        // was returned about, hence having requested_items passed in.
        //
        // on_cur_page: If greater than page_size it means we definately have
        // results on the next page as we fetch 1 row additional to see if we
        // can go to the next page.

        // We can figure out the total directly from this set of results
        if (this.total < 0 && on_cur_page != requested_items.size) this.set_total(requested_items.start + on_cur_page);

        // Don't update if we scrolled past the end
        if (this.total >= 0 && requested_items.start > this.total) return;

        if (!requested_items.infinite_scroll) this.last_start_update = requested_items.start;

        this.last_end_update = requested_items.start + Math.min(this.page_size, on_cur_page);

        // total must be greater than this number - don't display it, but we
        // can use it to see whether we have next pages or not.
        let min_total = requested_items.start + on_cur_page;
        if (min_total > this.min_total) this.min_total = min_total;
    }

    has_prev(): boolean {
        return this.last_start_update > 0;
    }
    has_next(): boolean {
        return this.last_end_update < Math.max(this.total, this.min_total);
    }
    first(): number {
        return this.last_start_update + 1;
    }
    last(): number {
        return this.last_end_update;
    }
    no_results(): boolean {
        return this.last_end_update === 0;
    } // Either no results at all, or still loading
}

interface DBSearchState {
    state: string;
    infinite_scroll?: boolean;
}

export class DBSearch {
    filters: DBFilters;
    db: CommonDB;
    state = new Subject<DBSearchState>();
    search!: Promise<string>;
    prepared_query!: Promise<unknown>;
    query_validity: string;
    pager: Pager = new Pager();
    private _pager_timeout?: ReturnType<typeof setTimeout>;

    constructor(db: CommonDB) {
        this.filters = get_filters(); // Cache original filters to send with feedback details
        this.db = db;
        this.query_validity = this.db.query_validity();
        this._refresh_query();
    }

    private _refresh_query(): void {
        this.search = unidecode(this.filters.search).then((str) => prepare_search_string(str.toLowerCase()));
        this.prepared_query = this.search.then((search: string) => this.db._prepare_query({ ...this.filters, search }));
        this.query_validity = this.db.query_validity();

        this.pager = new Pager();
    }

    // Is a new query needed on the given page for the specified db type?
    isEqual(cur_db: CommonDB): boolean {
        return cur_db.query_validity() == this.query_validity && isEqual(get_filters(), this.filters);
    }

    // Returns true if this search object is the one that should be active on
    // the page to avoid displaying stale data
    private _is_active(): boolean {
        return useSearchStore.getState().current_search === this;
    }

    subscribe(fn: (state: DBSearchState) => void) {
        return this.state.subscribe(fn);
    }

    private async _run(update_total: boolean, infinite_scroll: boolean = false): Promise<DBSearchRunResult> {
        // Don't do anything if this query is no longer valid, for example the database got updated
        if (this.db.query_validity() != this.query_validity) throw new Error('stale-query');

        let time_taken: number | undefined;
        const requested_items = this.pager.get_requested_items(infinite_scroll);

        this.state.next({ state: 'running', infinite_scroll });

        let promise = Promise.all([this.search, this.prepared_query])
            .then(([search, prepared_query]) => {
                let start_ts = Date.now();
                let promises: Promise<any>[] = [
                    this.db._run_search(prepared_query, requested_items).then((ret) => {
                        time_taken = Date.now() - start_ts;
                        this.db.add_timing_stat(time_taken);
                        return ret;
                    }),
                ];
                if (requested_items.start == 0 && search.length && !this.filters.source_id && !this.filters.album_id)
                    promises.push(this.db.search_meta(this.filters));

                return Promise.all(promises);
            })
            .then(([songs, meta]) => {
                let song_list: (Song | SongSource | Album)[] = [].concat(songs.data);

                // If we had the 1 extra row then throw it away - just shows we
                // can go onto the next page.
                if (song_list.length == requested_items.size) song_list.pop();

                if (meta) song_list.unshift(...meta);

                // This only happens if we scrolled far too far - drop these results
                if (requested_items.start > 0 && !songs.data.length) return songs;

                if (this._is_active()) {
                    // If update_total is false the _run_search fn may still choose
                    // to return a total for us to update so pass it through if so
                    if (songs.total) this.pager.set_total(songs.total);

                    this.pager.update(requested_items, songs.data.length);
                    if (infinite_scroll) song_list.unshift(...(useSongListStore.getState().items || []));
                    useSongListStore.getState().setSongList(song_list, requested_items, this.pager);

                    this.state.next({ state: 'resolved', infinite_scroll });
                }

                return songs;
            });

        // If the DB preferred to get total via a separate function, run that
        // later and don't wait on the promise as we can just update the pager
        // when the result comes back. This can significantly speed up
        // searching on local databases as getting the first X results is easy
        // but getting a full count can take a lot more time. On HTTP we can
        // also rely on HTTP caching for fetching the total which is quite
        // nice.
        let pager_time_taken: number;
        if (update_total) {
            // do this timeout clearing both when the initial query is executed
            // and also when the promise is processed to avoid duplicates as
            // much as possible
            if (this._pager_timeout) clearTimeout(this._pager_timeout);

            promise = Promise.all([this.prepared_query, promise]).then(([prepared_query, songs]) => {
                if (this._pager_timeout) clearTimeout(this._pager_timeout);

                // We figured the total out somehow without needing a direct pager query
                if (songs.total) return songs;

                let make_pager_query = () => {
                    if (!this._is_active())
                        // don't worry if the query went stale
                        return Promise.resolve(songs);

                    let _pager_start = Date.now();
                    return this.db._get_total(prepared_query).then((total) => {
                        pager_time_taken = Date.now() - _pager_start;
                        console.log(`Pager query took ${pager_time_taken}ms`);

                        if (this._is_active()) {
                            this.pager.set_total(total);
                            useSongListStore.getState().setPager(this.pager.clone()); // clone to force a rerender - nasty hack for PagerElem updates
                        }
                        songs.total = total;

                        return songs;
                    });
                };

                // Main query took rather a long time - debounce the pager update to avoid blocking any future searches
                if (!this.db._instant_total_query && time_taken! > 100) {
                    this._pager_timeout = setTimeout(make_pager_query, 1500);
                    return songs;
                }

                return make_pager_query();
            });
        }

        promise.finally(() => {
            let feedback: any = { ...this.filters };
            if (requested_items.start > 0) feedback.p = requested_items.start;

            // Log stats about how long it took, how many results were found or if it was an error
            if (time_taken !== undefined) feedback.t = time_taken;
            if (pager_time_taken !== undefined) feedback.pt = pager_time_taken;

            // Note: finally() doesn't receive the result, so we can't check ret here
            // strip defaults out to reduce bandwidth requirements for
            // tracking. Note we can only do first level as extend does not
            // deep-copy.
            if (!feedback.search.length) delete feedback.search;
            if (!Object.keys(feedback.advanced_tags).length) delete feedback.advanced_tags;
            if (feedback.order_by == 'default') delete feedback.order_by;
            send_search_event(feedback);
        });
        return promise;
    }

    run(): Promise<DBSearchRunResult> {
        // Mark this as the currently active query
        useSearchStore.getState().setCurrentSearch(this);

        return this._run(true);
    }

    // If query is invalid, then re-issue it correctly. Otherwise run the function specified.
    private _ensure_query_valid(fn: () => Promise<DBSearchRunResult>): Promise<DBSearchRunResult> {
        if (this.db.query_validity() != this.query_validity) {
            this._refresh_query();
            return this.run();
        }

        return fn();
    }

    change_page(direction: number): Promise<DBSearchRunResult> {
        return this._ensure_query_valid(() => {
            this.pager.change_page(direction);
            return this._run(false);
        });
    }

    infinite_scroll(): Promise<DBSearchRunResult> {
        return this._ensure_query_valid(() => {
            // Only do anything if we can actually change page
            if (this.pager.change_page(1, true)) return this._run(false, true);
            return Promise.reject<DBSearchRunResult>(new Error('cannot-scroll'));
        });
    }
}
