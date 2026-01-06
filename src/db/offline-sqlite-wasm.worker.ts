import { get_array_field, get_decompressed_key, get_number_field, maybe_recursive_decompress } from './compressed-key-map';
import { SQL } from './offline-sqlite-sql';

import * as Comlink from 'comlink';
import SQLiteESMFactory from '../../wa-sqlite/dist/wa-sqlite.mjs';
import { OPFSCoopSyncVFS as VFS } from '../../wa-sqlite/src/examples/OPFSCoopSyncVFS';
import * as SQLite from '../../wa-sqlite/src/sqlite-api';
import { type BindParams } from './offline-sqlite';

type FavouriteMap = Record<number, number | boolean | undefined>;

type SQLiteWasmHandle = unknown;
type SQLiteWasmVFS = unknown;
type SQLiteStatement = unknown;
type SQLiteValue = unknown;

interface SQLiteAPI {
    SQLITE_ROW: number;
    statements(db: SQLiteWasmHandle, sql: string): AsyncIterable<SQLiteStatement>;
    bind_collection(stmt: SQLiteStatement, params: SQLiteValue[]): void;
    step(stmt: SQLiteStatement): Promise<number>;
    column_names(stmt: SQLiteStatement): string[];
    row(stmt: SQLiteStatement): SQLiteValue[];
    reset(stmt: SQLiteStatement): Promise<void>;
    vfs_register(vfs: SQLiteWasmVFS, makeDefault: boolean): void;
    open_v2(path: string): Promise<SQLiteWasmHandle>;
}

export class SQLiteWorker {
    sqlite3!: SQLiteAPI;
    db: SQLiteWasmHandle;

    // Initialize SQLite.
    async startup(): Promise<void> {
        const module = await SQLiteESMFactory();
        this.sqlite3 = SQLite.Factory(module) as unknown as SQLiteAPI;

        // Register a custom file system.
        const vfs = await VFS.create('songs', module);
        this.sqlite3.vfs_register(vfs, true);

        // Open the database.
        this.db = await this.sqlite3.open_v2('songs');

        // TODO Optimize for performance? In testing not a massive difference anyway...
        //await exec('PRAGMA journal_mode = wal');
    }

    // Handle DB exec. Either has a list of sql+binds, or a single pair of sql, binds.
    // Returns [{col: val, ...}, ...] for the last executed statement.
    async exec<T>(..._args: [string, BindParams?][] | [string, BindParams?]): Promise<T[]> {
        // if first arg is a string then assume it's sql/vars as a single argument
        const args = (typeof _args[0] == 'string' ? [_args] : _args) as [string, BindParams?][];

        // Assume we now have an array of sql/vars. Pass them all over in one big
        // block to minimize comms channel overhead.
        let last_columns: undefined | string[],
            last_rows: any[] = []; // Store the result efficiently
        for (let i = 0; i < args.length; i++) {
            const save_results = i == args.length - 1;

            const [sql, binds] = args[i];
            //console.log('exec', sql, binds);

            for await (const stmt of this.sqlite3.statements(this.db, sql)) {
                last_rows = [];
                last_columns = undefined;
                if (binds && binds.length) this.sqlite3.bind_collection(stmt, binds);

                while ((await this.sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
                    if (save_results) {
                        last_columns = last_columns ?? this.sqlite3.column_names(stmt);
                        last_rows.push(this.sqlite3.row(stmt));
                    }
                }
            }
        }

        // Map row to object with column names as keys
        const result = last_rows.map((row) => Object.fromEntries(last_columns!.map((k, i) => [k, row[i]]))) as T[];
        //console.log('exec', args, 'returned', result);
        return result;
    }

    // Various extra functions to to push more work to the worker. The key things for performance, in order of importance
    // are:
    // 1. Reduce the number of messages passed between the worker and the main process
    // 2. Do inserts in a transaction
    // 3. Use prepared statements
    //
    // Pass multiple commands over in a batch to minimize message passing
    // overhead between the main process and the worker.

    // Run a bulk insert as a prepared statement, ignoring any results
    async bulk_exec(sql: string, binds: SQLiteValue[][]): Promise<void> {
        if (!binds.length) return;

        // TODO: Assumes only 1 statement here
        for await (const stmt of this.sqlite3.statements(this.db, sql) as AsyncIterable<SQLiteStatement>) {
            for (const bind of binds) {
                await this.sqlite3.reset(stmt);
                this.sqlite3.bind_collection(stmt, bind);

                while ((await this.sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
                    // Ignore results
                }
            }
        }
    }

    // add_songs is to allow quick bulk import via a single transaction. For
    // example, a French import of 2389 entries took 144s in sqlite3 itself (ie
    // no message passing overhead). However wrapping it in a txn it takes 2s.
    async add_songs(songs: Record<string, unknown>[], is_compressed: boolean, _fts_table: string | undefined, favourites: FavouriteMap): Promise<void> {
        const albumBindValues: SQLiteValue[][] = [];
        const sourceBindValues: SQLiteValue[][] = [];
        const tagBindValues: SQLiteValue[][] = [];
        const songBindValues: SQLiteValue[][] = [];

        for (const song of songs) {
            const id = get_number_field(is_compressed, song, 'id');
            if (id === undefined) continue;

            const favourite = favourites[id] ? 1 : 0;

            let has_mp3 = 0;
            let has_sheet = 0;
            const filesRaw = get_decompressed_key(is_compressed, song, 'files');
            const files = maybe_recursive_decompress(is_compressed, Array.isArray(filesRaw) ? filesRaw : []);
            for (const file of files) {
                if (file && typeof file === 'object' && !Array.isArray(file)) {
                    const fileObj = file as Record<string, unknown>;
                    const type = fileObj.type;
                    if (typeof type === 'string') {
                        if (/mp3$/.test(type)) has_mp3 = 1;
                        if (type === 'abccache' || /^sheet/.test(type)) has_sheet = 1;
                    }
                }
            }

            const altTitles = maybe_recursive_decompress(is_compressed, get_array_field(is_compressed, song, 'alternative_titles'));
            const relatedSongs = maybe_recursive_decompress(is_compressed, get_array_field(is_compressed, song, 'related_songs'));
            const info = maybe_recursive_decompress(is_compressed, get_array_field(is_compressed, song, 'info'));
            const alternativeSearchTitles = get_array_field<string>(is_compressed, song, 'alternative_search_titles');
            const songxml = get_decompressed_key<string>(is_compressed, song, 'songxml');

            songBindValues.push([
                id,
                get_decompressed_key(is_compressed, song, 'lang'),
                get_decompressed_key(is_compressed, song, 'title'),
                get_decompressed_key(is_compressed, song, 'source_title') ?? null,
                songxml,
                get_decompressed_key(is_compressed, song, 'songkey') ?? null,
                get_decompressed_key(is_compressed, song, 'capo') ?? null,
                JSON.stringify(altTitles),
                JSON.stringify(relatedSongs),
                JSON.stringify(info),
                JSON.stringify(files),
                get_decompressed_key(is_compressed, song, 'song_usage'),
                get_decompressed_key(is_compressed, song, 'rating') ?? null,
                get_decompressed_key(is_compressed, song, 'real_song_usage'),
                get_decompressed_key(is_compressed, song, 'song_ts'),
                favourite,
                get_decompressed_key(is_compressed, song, 'search_title', ''),
                alternativeSearchTitles.length ? JSON.stringify(alternativeSearchTitles) : null,
                get_decompressed_key(is_compressed, song, 'search_text', ''),
                get_decompressed_key(is_compressed, song, 'search_meta', ''),
                get_decompressed_key(is_compressed, song, 'sort_title'),
                get_decompressed_key(is_compressed, song, 'is_original') ? 1 : 0,
                get_decompressed_key(is_compressed, song, 'copyright_restricted'),
                has_mp3,
                has_sheet,
                songxml && /<chord>/.test(String(songxml)) ? 1 : 0,
                get_decompressed_key(is_compressed, song, 'year') ?? null,
            ]);

            for (const album of get_array_field<Record<string, unknown>>(is_compressed, song, 'albums')) {
                const albumId = get_number_field(is_compressed, album, 'album_id', 0);
                const trackNumber = get_number_field(is_compressed, album, 'track', 0);
                albumBindValues.push([id, albumId, trackNumber]);
            }

            for (const source of get_array_field<Record<string, unknown>>(is_compressed, song, 'sources')) {
                const sourceId = get_number_field(is_compressed, source, 'id', 0);
                const sourceNumber = get_number_field(is_compressed, source, 'number') ?? null;
                sourceBindValues.push([id, sourceId, sourceNumber]);
            }

            for (const tagId of get_array_field<number>(is_compressed, song, 'tags')) {
                tagBindValues.push([id, tagId]);
            }
        }

        await this.bulk_exec(SQL.add_song_song, songBindValues);
        await this.bulk_exec(SQL.add_song_album, albumBindValues);
        await this.bulk_exec(SQL.add_song_source, sourceBindValues);
        await this.bulk_exec(SQL.add_song_tag, tagBindValues);
    }
}

Comlink.expose(new SQLiteWorker());
