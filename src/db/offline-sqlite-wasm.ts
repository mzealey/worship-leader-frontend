// TODO: Only build this file if we are in a non-phonegap build

import * as Comlink from 'comlink';
import * as wa_sqlite_package from '../../wa-sqlite/package.json';
import { type FavouriteDB } from '../favourite-db';
import { get_client_type } from '../globals';
import { type LangPackResponse } from './offline-common';
import { OfflineSQLiteDB, type BindParams, type ExecFunction } from './offline-sqlite';
import { SQL } from './offline-sqlite-sql';
import type { SQLiteWorker } from './offline-sqlite-wasm.worker';

export let supports_browser_sqlite: boolean =
    !!(get_client_type() == 'www' || get_client_type() == 'chr') &&
    /* iOS 14 doesn't have this key capability for sqlite wasm */
    !!window.BigInt64Array &&
    /* Some androids dont seem to have this required for the OPFSCoopSyncVFS worker */
    !!window.FinalizationRegistry;

// Try loading and opening via worker process the sqlite database. This should
// only ever happen once in the app. If there was a load error then it may
// hang, meaning you should likely race this response against a timeout which
// will fallback to online db in case of a load error.
type SQLiteRemoteWorker = Comlink.Remote<SQLiteWorker>;
let db: Promise<SQLiteRemoteWorker>;
export const try_load_sqlite_wasm = async (): Promise<SQLiteRemoteWorker> => {
    if (!db) {
        const start = Date.now();
        db = new Promise((resolve) => {
            // I've tried writing spec tests for this as it's a key part of the program, and with @vitest/web-worker it
            // loads but Commlink doesn't want to work and even if it does the startup process hangs.
            const worker = new Worker(new URL('./offline-sqlite-wasm.worker.ts', import.meta.url), { type: 'module' });
            const obj = Comlink.wrap<SQLiteWorker>(worker);
            obj.startup().then(() => resolve(obj));
        });
        try {
            await db;
            console.log('startup for wasm completed after', Date.now() - start, 'ms');
        } catch (e) {
            supports_browser_sqlite = false;
        }
    }

    return db;
};

// Force this to run in the background at startup so that we don't lag on
// waiting for it to load
if (supports_browser_sqlite) try_load_sqlite_wasm();

/* WASM SQLite3 implementation of the song database. With the obsoletion of
 * WebSQL this is the best route still available to us, and seems to be
 * generally performant and portable.
 *
 * Queries in the SQL worker thread run synchronously so if you have a
 * long-running query it will block the others; however they won't block the
 * UI.
 */
export class OfflineWASMDB extends OfflineSQLiteDB {
    _offline_type = 'wa-sqlite';
    _last_update_key = 'sqlite-wasm-update';

    private db: SQLiteRemoteWorker;

    constructor(favorite_db: FavouriteDB, db: SQLiteRemoteWorker) {
        super(favorite_db);
        this.db = db;
    }

    get_version_string(): string {
        let text = super.get_version_string();
        text += ` (WASM version ${wa_sqlite_package.version})`;
        return text;
    }

    _should_try_fts(): boolean {
        return false;
    }

    // Because of message passing overhead we want to use big batches. But we
    // also want to show progress to the end-user so we need somewhat smaller
    // chunks too.
    _import_batch_size = 500;

    serialized_txns = Promise.resolve();

    async trans(callback: (exec: ExecFunction) => Promise<void>, rw: boolean): Promise<void> {
        if (rw) {
            // Serialized access to the database if in a mutation txn to ensure only the
            // txn queries are run and complete before other stuff happens.
            //
            // Idea taken from https://advancedweb.hu/how-to-serialize-calls-to-an-async-function/
            const res = this.serialized_txns.then(async () => {
                //console.error('begin rw txn', callback);
                try {
                    await this.db.exec('BEGIN');
                } catch (err) {
                    console.error('BEGIN failed, ignoring', err);
                    throw err;
                }
                try {
                    // In WebSQL we cannot use promises, but _exec here creates
                    // promises. So we need to collect them and wait for them
                    // all to finish successfully, and pray that they execute
                    // in parallel correctly.
                    const promises: Promise<unknown[]>[] = [];
                    const execWrapper = ((...args: [string, BindParams?]) => {
                        promises.push(this.db.exec(...(args as Parameters<SQLiteWorker['exec']>)));
                    }) as ExecFunction;
                    const res = await callback(execWrapper);
                    await Promise.all(promises);
                    //console.error('end rw txn', callback);
                    await this.db.exec('COMMIT');
                    return res;
                } catch (err) {
                    console.error('rollback rw txn', err);
                    await this.db.exec('ROLLBACK');
                    throw err;
                }
            });
            // Ignore queue errors but pass them back to the caller
            this.serialized_txns = res.catch(() => {});
            return res;
        } else {
            return callback(this.db.exec);
        }
    }

    async single_query<T>(cmd: string, vars?: BindParams, _rw?: boolean): Promise<T[]> {
        // should also support rw parameter
        //console.log(cmd, vars);
        try {
            const result = await this.db.exec(cmd, vars);
            //console.log(cmd, vars, 'returned', result);
            return result as T[];
        } catch (err) {
            console.error('sql failed:', err);
            throw err;
        }
    }
    single_rw_query = this.single_query;

    async _add_songs(_exec: ExecFunction, songs: Array<Record<string, unknown>>, is_compressed?: boolean): Promise<void> {
        // Run bulk imports in the worker process as a single transaction for maximal performance. For 3000 songs goes from 150s to 2s when doing like this.
        // If run from a main-thread txn with all the inserts happening individually it takes about 10s
        // Must be called from within a txn
        await this.db.add_songs(songs, !!is_compressed, this.fts_table, this.FAVOURITE_DB.get_favourites());
    }

    // Higher performance than the standard sqlite one - make the worker process do it in bulk
    async _populate_dbmeta(to_import: LangPackResponse): Promise<void> {
        await this.rw_trans(async () => {
            await this.db.bulk_exec(
                SQL.add_dbmeta_sources,
                to_import.song_source_info!.map((source) => [source.id, source.lang, source.name, source.abbreviation, source.searchdata, source.sort_title]),
            );

            await this.db.bulk_exec(
                SQL.add_dbmeta_albums,
                to_import.albums!.map((album) => [album.id, album.lang, album.searchdata, JSON.stringify(album)]),
            );
        });
    }

    async _supports_without_rowid(): Promise<boolean> {
        return true;
    }
}
