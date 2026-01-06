import { get_db_path } from './globals';
import { persistentStorage } from './persistent-storage.es5';
import { fetch_json } from './util';

// TODO: Merge common code with song-languages

export interface MetaDbTagMapping {
    id: number;
    tag_group: string;
    tag_code: string;
    count?: number;
}
export type MetaDb = {
    tag_mappings: Record<string, MetaDbTagMapping>;
    tag_groups: Record<string, Record<string, string | undefined>>;
    tags: Record<string, Record<string, string | undefined> | undefined>;
};

// Timestamp and promise of the last request to load the meta db
let _meta_last_load: number | undefined;
let _meta_last_promise: Promise<MetaDb> | undefined;

/* Return contents of the meta db from the server (tags, albums etc).
 *
 * As we may not have an internet connection, try updating in the
 * background until we get a successful hit. This means that the first
 * request(s) via get_meta_db() will get an old version but after that
 * hopefully new versions
 */
export async function refresh_meta_db(): Promise<MetaDb> {
    // Don't continually hit the server, only at most every hour even when forced refresh happens
    if (_meta_last_load && Date.now() - _meta_last_load < 3600 * 1000 && _meta_last_promise) return _meta_last_promise;

    let loading_meta_promise: Promise<MetaDb> | undefined;

    // If we are in a live build then see if we had metadb injected
    if (BUILD_TYPE == 'www') {
        let elem = document.getElementById(`json-metadb`);
        if (elem) loading_meta_promise = Promise.resolve(JSON.parse(elem.innerHTML) as MetaDb);
    }

    if (!loading_meta_promise) loading_meta_promise = fetch_json<MetaDb>(`${get_db_path()}.smeta.json`, { cache: 'no-store' });

    loading_meta_promise = loading_meta_promise.then((meta: MetaDb) => {
        _meta_last_load = Date.now();
        persistentStorage.setObj('meta-db-update', _meta_last_load);
        persistentStorage.setObj('meta-db', meta);

        _meta_last_promise = Promise.resolve(meta);
        return meta;
    });
    return loading_meta_promise;
}

/* Just try to load the meta db from the current cache when requested. If we
 * want to refresh the meta database etc then we call refresh_meta_db() above.
 *
 * However if we're on OnlineDB we need to refresh the meta db periodically
 * otherwise it will never get updated.
 *
 */
export const get_meta_db_update_ts = () => persistentStorage.getObj('meta-db-update', 0);
export function get_meta_db(): Promise<MetaDb> {
    if (_meta_last_promise)
        // Any time after startup
        return _meta_last_promise;

    // Load whatever used to be in the database anyway as we may not have an internet connection
    const meta_obj = persistentStorage.getObj<MetaDb>('meta-db');
    if (meta_obj) _meta_last_promise = Promise.resolve(meta_obj);

    if (!_meta_last_promise || Date.now() - get_meta_db_update_ts() > 7 * 24 * 60 * 60 * 1000) {
        const refresh_promise = refresh_meta_db();
        // If we had a previous version return this for speed while perhaps
        // doing the background update above. If not then return the waiting
        // one.
        if (!_meta_last_promise) _meta_last_promise = refresh_promise;
    }

    return _meta_last_promise;
}
