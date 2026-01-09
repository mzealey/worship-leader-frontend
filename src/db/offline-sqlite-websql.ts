import { FavouriteDB } from '~/favourite-db';
import { BUILD_TYPE } from '../globals';
import { RejectReason } from '../util';
import { BindParams, ExecFunction, OfflineSQLiteDB, SQLiteValue } from './offline-sqlite';

interface WebSQLResultSet {
    rows: {
        length: number;
        item(index: number): Record<string, unknown>;
    };
}

interface WebSQLTransaction {
    executeSql(
        sqlStatement: string,
        args: SQLiteValue[],
        callback: (transaction: WebSQLTransaction, resultSet: WebSQLResultSet) => void,
        errorCallback: (transaction: WebSQLTransaction, error: RejectReason) => void,
    ): void;
}

type SQLiteOpenArgs = unknown;

interface WebSQLDatabase {
    transaction(callback: (transaction: WebSQLTransaction) => void, errorCallback?: (error: RejectReason) => void): void;
    readTransaction(callback: (transaction: WebSQLTransaction) => void, errorCallback?: (error: RejectReason) => void): void;
    openargs?: SQLiteOpenArgs;
}

/* WebSQL implementation of the song database. This is now only used on
 * android/ios due to it being deprecated on browsers. Browsers with WASM
 * support can use offline-wasm which runs sqlite via wasm plugin.
 *
 * Queries run synchronously so if you have a long-running query it will block
 * the others; however these queries should run without blocking the UI thread
 * so it may not feel too laggy for the user. This means that background song
 * updates don't block the UI, but you want to do the add songs in small
 * batches so that other queries can run in the mean-time.
 */

export class OfflineWebSQLDB extends OfflineSQLiteDB {
    quota: number;
    private db: WebSQLDatabase;

    constructor(favourite_db: FavouriteDB, db: WebSQLDatabase, quota = 0) {
        super(favourite_db);
        this.quota = quota;
        this.db = db;
    }
    _offline_type = 'websql';
    _last_update_key = 'websql-update';

    _is_cordova_sqlite(): boolean {
        return BUILD_TYPE == 'phonegap' && 'sqlitePlugin' in window && 'openargs' in this.db;
    }

    get_version_string(): string {
        const text = super.get_version_string();
        return `${text}. Quota: ${this.quota}`;
    }

    // Some older versions of chrome had fts support but it was rubbish; needs
    // the custom cordova sqlite plugin
    //
    // For the moment we disable FTS because FTS5 is broken per
    // https://sqlite.org/forum/info/dde862dbb3339564 - we shouldn't have been
    // using DELETE so the FTS table is corrupted. TODO: Fix FTS5
    // implementation so that it handles all the 'Error: database disk image is
    // malformed' issues more nicely per https://www.sqlite.org/fts5.html
    // delete functionality
    _should_try_fts(): boolean {
        return false;
    } //this._is_cordova_sqlite() }

    // Runs the specified callback within a transaction context and returns a
    // promise for when the transaction has all completed. The callback MUST
    // NOT contain promises.
    trans(callback: (exec: ExecFunction) => void, rw: boolean): Promise<void> {
        // Have to have this as a callback because in WebSQL I think a promise
        // would execute outside of the actual DB transacition
        return new Promise((resolve, reject) => {
            //console.log("Txn started");
            this.db[rw ? 'transaction' : 'readTransaction'](
                (tx: WebSQLTransaction) => {
                    // MUST NOT be promises in here otherwise it will run outside
                    // of the transaction context and blow up
                    const exec: ExecFunction = (...args) => {
                        // if first arg is a string then assume it's sql/vars as a single argument
                        if (typeof args[0] == 'string') {
                            //console.log("exec", args[0], args[1]);
                            tx.executeSql(
                                args[0],
                                args[1] || [],
                                () => {}, // do nothing on success
                                (tx, msg) => reject(msg),
                            );
                        } else {
                            // array of sql to execute
                            const execs = args as [string, BindParams?][];
                            for (const arg of execs) exec(...arg);
                        }
                    };

                    callback(exec);
                    // Complete the promise when everything else has run
                    // (there's an internal queue in WebSQL which prevents more
                    // than 1 exec from happening at a time so when this has
                    // run we know our txn has completed successfully)
                    tx.executeSql(
                        'SELECT 1',
                        [],
                        () => resolve(),
                        (_tx, msg) => reject(msg),
                    );
                },
                (err: RejectReason) => {
                    console.error('txn failed', err);
                    reject(err);
                },
            );
        }); //.then(() => console.log("Txn completed"), err => console.error(err));
    }

    async single_query<T>(cmd: string, vars: BindParams = [], rw = false): Promise<T[]> {
        try {
            const results = await new Promise<WebSQLResultSet>((resolve, reject) => {
                this.db[rw ? 'transaction' : 'readTransaction'](
                    (tx: WebSQLTransaction) =>
                        tx.executeSql(
                            cmd,
                            vars,
                            (_tx, res) => resolve(res),
                            (_tx, msg) => reject(msg),
                        ),
                    (err: RejectReason) => reject(err),
                );
            });

            // Row items need copying as they are not direct array objects. This is an
            // issue only on certain platforms so watch out. Object.assign and spread
            // operator don't seem to do this correctly so we need to do this old-school.
            const len = results.rows.length;
            const rows: T[] = [];
            for (let i = 0; i < len; i++) {
                const row: Partial<T> = {};
                const from = results.rows.item(i) as Record<string, unknown>;
                for (const name in from) (row as Record<string, unknown>)[name] = from[name];
                rows.push(row as T);
            }
            return rows;
        } catch (msg) {
            console.error('sql failed:', msg);
            throw { message: msg };
        }
    }
    single_rw_query<T>(cmd: string, vars?: BindParams): Promise<T[]> {
        return this.single_query<T>(cmd, vars, true);
    }

    async _supports_without_rowid(): Promise<boolean> {
        // returns promise of 0 or 1 depending on whether sqlite supports
        // WITHOUT ROWID optimization. Introduced in 3.8.2 (2013-12) so some
        // older clients may not support it yet
        try {
            await this.rw_trans((exec) => {
                exec('create table test_without_rowid ( a INT NOT NULL, b INT NOT NULL, PRIMARY KEY (a,b) ) WITHOUT ROWID');
                exec('drop table if exists test_without_rowid');
            });
            return true;
        } catch (e) {
            return false;
        }
    }

    // Nuke the DB so that the app resets itself
    async kill_db(): Promise<void> {
        if (this._is_cordova_sqlite()) window.sqlitePlugin.deleteDatabase(this.db.openargs);
        else return super.kill_db();
    }
}
