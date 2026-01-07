import type { DBRequestedItems, DBSearchRunResult } from '../db-search';
import { persistentStorage } from '../persistent-storage.es5';
import { Album, Song, SongSource } from '../song';
import { _SearchMetaResult, type DBFilters, type SearchMetaFilters } from './common';
import { get_array_field, get_decompressed_key, get_number_field, maybe_recursive_decompress } from './compressed-key-map';
import { OfflineDBCommon, type LangPackResponse } from './offline-common';
import { SQL } from './offline-sqlite-sql';

export type SQLiteValue = unknown;

export type BindParams = (number | string | null)[];
export type ExecFunction = {
    (sql: string, params?: BindParams): Promise<unknown> | void;
    (...args: [string, BindParams?][]): Promise<unknown> | void;
};

function _generate_in_placeholders(count: number): string {
    return '(' + '?,'.repeat(count - 1) + '?)';
}

interface DBQuery {
    from: string;
    where: string;
    params: BindParams;
    order_by: string;
    order_params: BindParams;
    fallback_fetch: (string | number)[];
}

// Base class providing general offline SQLite details shared between WebSQL
// and SQLite-WASM implementations
export abstract class OfflineSQLiteDB extends OfflineDBCommon {
    fts_table?: string;

    // Stuff that child-classes need to implement
    abstract _should_try_fts(): boolean;
    abstract trans(callback: (exec: ExecFunction) => void | Promise<void>, rw: boolean): Promise<void>;
    abstract single_query<T>(cmd: string, vars?: BindParams, rw?: boolean): Promise<T[]>;
    abstract single_rw_query<T>(cmd: string, vars?: BindParams): Promise<T[]>;
    abstract _supports_without_rowid(): Promise<boolean>;

    // monotonically increasing number needs to be bumped every time we want to
    // change the schema in this database.
    DB_VERSION = 49;

    // Batch size used for adding songs to the database
    _import_batch_size = 300;

    rw_trans(callback: (exec: ExecFunction) => void | Promise<void>): Promise<void> {
        return this.trans(callback, true);
    }

    async _supports_fts(version: number): Promise<boolean> {
        // returns 0 or 1 depending on whether supports the given fts version or not
        if (!this._should_try_fts()) return false;

        try {
            await this.rw_trans((exec) => {
                exec(`create virtual table fts_test${version} using fts${version}(content)`);
                exec(`drop table if exists fts_test${version}`);
            });
            return true;
        } catch (e) {
            return false;
        }
    }

    get_version_string(): string {
        let text = super.get_version_string();
        text += this.fts_table ? `. With FTS ${this.fts_table}` : `. Without FTS (${this._should_try_fts() ? 'but tried' : 'not tried'})`;
        return text;
    }

    // Return a list of languages currently loaded in the database
    async list_loaded_langs(): Promise<string[]> {
        try {
            const rows = await this.single_query<{ lang: string }>('SELECT DISTINCT lang FROM songs');
            return rows.map((row) => row.lang);
        } catch (e) {
            return [];
        }
    }

    async has_any_songs(): Promise<boolean> {
        return (await this.list_loaded_langs()).length > 0;
    }

    _add_songs(exec: ExecFunction, songs: Array<Record<string, unknown>>, is_compressed?: boolean): void {
        // Called within a transaction
        const compressed = !!is_compressed;

        for (const song of songs) {
            const id = get_number_field(compressed, song, 'id');
            if (id === undefined) continue;

            const favourite = this.FAVOURITE_DB.get_favourite(id) ? 1 : 0;

            let has_mp3 = 0;
            let has_sheet = 0;
            const filesRaw = get_decompressed_key(compressed, song, 'files');
            const files = maybe_recursive_decompress(compressed, Array.isArray(filesRaw) ? filesRaw : []);
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

            const alternativeTitles = maybe_recursive_decompress(compressed, get_array_field(compressed, song, 'alternative_titles'));
            const relatedSongs = maybe_recursive_decompress(compressed, get_array_field(compressed, song, 'related_songs'));
            const info = maybe_recursive_decompress(compressed, get_array_field(compressed, song, 'info'));
            const alternativeSearchTitles = get_array_field<string>(compressed, song, 'alternative_search_titles');
            const songxml = get_decompressed_key<string>(compressed, song, 'songxml');

            exec(SQL.add_song_song, [
                id,
                get_decompressed_key(compressed, song, 'lang') ?? null,
                get_decompressed_key(compressed, song, 'title') ?? null,
                get_decompressed_key(compressed, song, 'source_title') ?? null,
                songxml ?? null,
                get_decompressed_key(compressed, song, 'songkey') ?? null,
                get_decompressed_key(compressed, song, 'capo') ?? null,
                JSON.stringify(alternativeTitles),
                JSON.stringify(relatedSongs),
                JSON.stringify(info),
                JSON.stringify(files),
                get_decompressed_key(compressed, song, 'song_usage') ?? null,
                get_decompressed_key(compressed, song, 'rating') ?? null,
                get_decompressed_key(compressed, song, 'real_song_usage') ?? null,
                get_decompressed_key(compressed, song, 'song_ts') ?? null,
                favourite,
                get_decompressed_key(compressed, song, 'search_title', ''),
                alternativeSearchTitles.length ? JSON.stringify(alternativeSearchTitles) : null,
                get_decompressed_key(compressed, song, 'search_text', ''),
                get_decompressed_key(compressed, song, 'search_meta', ''),
                get_decompressed_key(compressed, song, 'sort_title') ?? null,
                get_decompressed_key(compressed, song, 'is_original') ? 1 : 0,
                get_decompressed_key(compressed, song, 'copyright_restricted') ?? null,
                has_mp3,
                has_sheet,
                songxml && /<chord>/.test(String(songxml)) ? 1 : 0,
                get_decompressed_key(compressed, song, 'year') ?? null,
            ]);

            if (this.fts_table) {
                exec(`INSERT INTO ${this.fts_table} (rowid, search_title, search_text, search_meta) values (?,?,?,?)`, [
                    id,
                    get_decompressed_key(compressed, song, 'search_title', ''),
                    get_decompressed_key(compressed, song, 'search_text', ''),
                    get_decompressed_key(compressed, song, 'search_meta', ''),
                ]);
            }

            for (const album of get_array_field<Record<string, unknown>>(compressed, song, 'albums')) {
                const albumId = get_number_field(compressed, album, 'album_id', 0);
                const trackNumber = get_number_field(compressed, album, 'track', 0);
                exec(SQL.add_song_album, [id, albumId, trackNumber]);
            }

            for (const source of get_array_field<Record<string, unknown>>(compressed, song, 'sources')) {
                const sourceId = get_number_field(compressed, source, 'id', 0);
                const sourceNumber = get_number_field(compressed, source, 'number') ?? null;
                exec(SQL.add_song_source, [id, sourceId, sourceNumber]);
            }

            for (const tagId of get_array_field<number>(compressed, song, 'tags')) {
                exec(SQL.add_song_tag, [id, tagId]);
            }
        }
    }

    // Given a single song that does not exist in the database, add it into the
    // database
    async add_song(song: Song): Promise<void> {
        await this.rw_trans((exec) => {
            // Kill off any remanent first. Only need to do this when replacing a song
            if (this.fts_table) {
                if (this.fts_table == 'fts5') exec(`INSERT INTO ${this.fts_table} (${this.fts_table}, rowid) VALUES (?, ?)`, ['delete', song.id]);
                else exec(`DELETE FROM ${this.fts_table} WHERE rowid = ?`, [song.id]);
            }

            exec(
                ['DELETE FROM songs WHERE id = ?', [song.id]],
                ['DELETE FROM song_source WHERE song_id = ?', [song.id]],
                ['DELETE FROM song_tags WHERE song_id = ?', [song.id]],
                ['DELETE FROM album_songs WHERE song_id = ?', [song.id]],
            );

            this._add_songs(exec, [song as Record<string, unknown>]);
        });
    }

    async _create_db_tables(supports_without_rowid: boolean, supports_fts5: boolean, supports_fts4: boolean): Promise<void> {
        const without_rowid = supports_without_rowid ? 'WITHOUT ROWID' : '';

        // Reset all the timestamps for db updates
        persistentStorage.setObj(this._last_update_key, {});

        try {
            await this.rw_trans((exec) => {
                exec(
                    ['drop table if exists version'],
                    ['CREATE TABLE version (version INTEGER NOT NULL)'],
                    ['INSERT INTO version(version) VALUES (?)', [this.DB_VERSION]],
                    ['drop table if exists song_source_info'],
                    [
                        `
                        CREATE TABLE song_source_info (
                            id INTEGER NOT NULL PRIMARY KEY,
                            lang VARCHAR(15) NOT NULL,
                            name VARCHAR(255) NOT NULL COLLATE NOCASE,
                            abbreviation VARCHAR(255) COLLATE NOCASE,
                            searchdata TEXT COLLATE NOCASE,
                            sort_title TEXT NOT NULL
                        )
                    `,
                    ],

                    ['drop table if exists albums'],
                    [
                        `
                        CREATE TABLE albums (
                            id INTEGER NOT NULL PRIMARY KEY,
                            lang VARCHAR(15) NOT NULL,
                            searchdata TEXT COLLATE NOCASE,
                            data TEXT
                        )
                    `,
                    ],

                    ['drop table if exists songs'],
                    [
                        `
                        CREATE TABLE songs (
                            id INTEGER NOT NULL PRIMARY KEY,
                            lang VARCHAR(15) NOT NULL,
                            title VARCHAR(255) NOT NULL,
                            source_title VARCHAR(255),
                            search_title TEXT COLLATE NOCASE,
                            alternative_search_titles TEXT COLLATE NOCASE,
                            search_text TEXT COLLATE NOCASE,
                            search_meta TEXT COLLATE NOCASE,
                            songxml TEXT NOT NULL,
                            rating INTEGER,
                            songkey VARCHAR(15),
                            capo INTEGER,
                            alternative_titles TEXT,
                            info TEXT,
                            files TEXT,
                            related_songs TEXT,
                            song_usage INTEGER,
                            real_song_usage INTEGER,
                            song_ts INTEGER,
                            year INTEGER,
                            favourite INTEGER NOT NULL,
                            is_original INTEGER NOT NULL,
                            copyright_restricted INTEGER NOT NULL,
                            has_chord INTEGER NOT NULL,
                            has_sheet INTEGER NOT NULL,
                            has_mp3 INTEGER NOT NULL,
                            sort_title TEXT NOT NULL
                        )
                    `,
                    ],
                    ['CREATE INDEX song_usage_idx ON songs(song_usage DESC)'],
                    ['CREATE INDEX real_song_usage_idx ON songs(real_song_usage DESC)'],
                    ['CREATE INDEX title_idx ON songs(sort_title)'],
                    ['CREATE INDEX rating_idx ON songs(rating)'],
                    ['CREATE INDEX ts_idx ON songs(song_ts)'],
                    ['CREATE INDEX year_idx ON songs(year)'],
                    ['CREATE INDEX favourite_idx ON songs(favourite)'],
                    ['CREATE INDEX is_original_idx ON songs(is_original)'],
                );

                if (supports_fts5 || supports_fts4) {
                    exec('DROP TABLE IF exists fts5');
                    exec('DROP TABLE IF exists fts4');

                    if (supports_fts5) {
                        // TODO: columnsize=0 to save ~1% space if we dont want to
                        // use ranking
                        //
                        // List of tokenchars from prepare_search_string()
                        exec(
                            `CREATE VIRTUAL TABLE fts5 USING fts5(search_title, alternative_search_titles, search_text, search_meta,
                                            content = songs, content_rowid = id, tokenize = "ascii tokenchars '@,'")`,
                        );
                        this.fts_table = 'fts5';
                    } else if (supports_fts4) {
                        exec(
                            'CREATE VIRTUAL TABLE fts4 USING fts4(content="songs", search_title, alternative_search_titles, search_text, search_meta, matchinfo=fts3)',
                        );
                        this.fts_table = 'fts4';
                    }
                }

                exec(
                    ['drop table if exists song_source'],
                    [
                        `CREATE TABLE song_source (
                            song_id INTEGER NOT NULL,
                            song_source_info_id INTEGER NOT NULL,
                            number INTEGER,
                            PRIMARY KEY(song_id, song_source_info_id)
                        ) ${without_rowid}
                    `,
                    ],

                    ['drop table if exists song_tags'],
                    [
                        `CREATE TABLE song_tags (
                            song_id INTEGER NOT NULL,
                            tag_id INTEGER NOT NULL,
                            PRIMARY KEY(tag_id, song_id)
                        ) ${without_rowid}
                    `,
                    ],
                    ['CREATE INDEX song_id_idx ON song_tags(song_id)'],

                    // NOTE: If we need to change this schema, back up the table and then restore it
                    //    ['drop table if exists usage_stat'],
                    [
                        `CREATE TABLE IF NOT EXISTS usage_stat (
                            song_id INTEGER NOT NULL PRIMARY KEY,
                            last_view INTEGER NOT NULL,
                            total_views INTEGER NOT NULL
                        )
                    `,
                    ],
                    ['CREATE INDEX IF NOT EXISTS last_view_idx ON usage_stat(last_view)'],
                    ['CREATE INDEX IF NOT EXISTS total_views_idx ON usage_stat(total_views)'],

                    ['drop table if exists album_songs'],
                    [
                        `CREATE TABLE album_songs (
                            song_id INTEGER NOT NULL,
                            album_id INTEGER NOT NULL,
                            track INTEGER NOT NULL,
                            PRIMARY KEY(album_id, song_id, track)
                        ) ${without_rowid}
                    `,
                    ],
                    // Run resolve on the last query at success
                    ['CREATE INDEX album_songs_song_id_idx ON album_songs(song_id)'],
                );
            });
        } catch (e) {
            console.error('create db failed:', e);
            throw e;
        }
    }

    async _recreate_db(): Promise<void> {
        // Test various sqlite feature support and create the database accordingly
        const [supports_without_rowid, supports_fts5, supports_fts4] = await Promise.all([
            this._supports_without_rowid(),
            this._supports_fts(5),
            this._supports_fts(4),
        ]);
        await this._create_db_tables(supports_without_rowid, supports_fts5, supports_fts4);

        // Fetch the basic metadata - will automatically be refreshed
        // periodically by do_background_refresh() as with the song data
        await this.add_languages(['dbmeta'], true);
    }

    async _populate_dbmeta(to_import: LangPackResponse): Promise<void> {
        await this.rw_trans((exec) => {
            // TODO: Could run in batches of say 1000 at a time in a single exec/txn
            const sources = (to_import.song_source_info as Array<Record<string, unknown>>) ?? [];
            for (const source of sources) {
                const sourceRec = source as Record<string, unknown>;
                exec(SQL.add_dbmeta_sources, [
                    sourceRec.id as number,
                    (sourceRec.lang as string) ?? '',
                    (sourceRec.name as string) ?? '',
                    (sourceRec.abbreviation as string) ?? null,
                    (sourceRec.searchdata as string) ?? null,
                    (sourceRec.sort_title as string) ?? '',
                ]);
            }

            const albums = (to_import.albums as Array<Record<string, unknown>>) ?? [];
            for (const album of albums) {
                const albumRec = album as Record<string, unknown>;
                exec(SQL.add_dbmeta_albums, [
                    albumRec.id as number,
                    (albumRec.lang as string) ?? '',
                    (albumRec.searchdata as string) ?? '',
                    JSON.stringify(albumRec),
                ]);
            }
        });
    }

    async _populate_lang(
        to_import: LangPackResponse,
        lang_code: string,
        is_compressed: boolean,
        rows_loaded_callback?: (count: number, total: number) => void,
    ): Promise<void> {
        const current_ids = (await this.single_query<{ id: number }>('SELECT id FROM songs WHERE lang = ?', [lang_code])).map((row) => row.id as number);
        const importData = [...((to_import.data as Song[]) ?? [])];
        const import_ids = new Set<number>(
            importData
                .map((song) => Number(get_decompressed_key(is_compressed, song as Record<string, unknown>, 'id')))
                .filter((id): id is number => Number.isFinite(id)),
        );
        const ids_to_delete = current_ids.filter((id) => !import_ids.has(id));

        // Special-case: erase the whole language from the database
        if (!import_ids.size) {
            await this.rw_trans((exec) => {
                if (this.fts_table) {
                    if (this.fts_table == 'fts5')
                        exec(`INSERT INTO ${this.fts_table} (${this.fts_table}, rowid) SELECT 'delete', id FROM songs WHERE lang = ?`, [lang_code]);
                    else exec(`DELETE FROM ${this.fts_table} WHERE rowid IN ( SELECT id FROM songs WHERE lang = ? )`, [lang_code]);
                }
                exec(
                    ['DELETE FROM song_source WHERE song_id IN ( SELECT id FROM songs WHERE lang = ? )', [lang_code]],
                    ['DELETE FROM album_songs WHERE song_id IN ( SELECT id FROM songs WHERE lang = ? )', [lang_code]],
                    ['DELETE FROM song_tags WHERE song_id IN ( SELECT id FROM songs WHERE lang = ? )', [lang_code]],
                    ['DELETE FROM songs WHERE lang = ?', [lang_code]],
                );
            });
            return;
        }

        const start = new Date();

        // For performance, delete individual song ids rather than the whole database
        if (ids_to_delete.length) {
            const placeholders = _generate_in_placeholders(ids_to_delete.length);

            await this.rw_trans((exec) => {
                if (this.fts_table) {
                    if (this.fts_table == 'fts5')
                        exec(`INSERT INTO ${this.fts_table} (${this.fts_table}, rowid) SELECT 'delete', id FROM songs id in ${placeholders}`, ids_to_delete);
                    else exec(`DELETE FROM ${this.fts_table} WHERE rowid IN ${placeholders}`, ids_to_delete);
                }
                exec(
                    [`DELETE FROM song_source WHERE song_id IN ${placeholders}`, ids_to_delete],
                    [`DELETE FROM album_songs WHERE song_id IN ${placeholders}`, ids_to_delete],
                    [`DELETE FROM song_tags WHERE song_id IN ${placeholders}`, ids_to_delete],
                    [`DELETE FROM songs WHERE id IN ${placeholders}`, ids_to_delete],
                );
            });
        }

        // Load in batched txns to allow other db access to go on without being
        // blocked so much. Update the spinner periodically as it's going on.
        const len = importData.length;
        await this.rw_trans((exec) => {
            while (importData.length) {
                // In theory this should interrupt the frontend querying etc
                // less than a single large txn especially when importing a
                // large number of songs. However in reality it significantly
                // slows down the load process
                //await this.rw_trans(exec => this._add_songs(exec, to_import.data.splice(0, this._import_batch_size), is_compressed));

                this._add_songs(exec, importData.splice(0, this._import_batch_size), is_compressed);
                if (rows_loaded_callback) rows_loaded_callback(len - importData.length, len);
            }
        });

        const duration = new Date().getTime() - start.getTime();
        console.log('Added', len, 'songs in', duration, 'ms. Performance of', (len / duration) * 1000, 'songs/s');
    }

    async _initialize_db(): Promise<void> {
        try {
            // If this fails, we'll get a catch below which will try to create the schema
            let rows = await this.single_query<{ version: number }>('SELECT version FROM version');

            // db exists, check the version string returned. Re-init if it is required
            if (rows.length != 1 || rows[0].version != this.DB_VERSION) {
                try {
                    await this._recreate_db();
                    return;
                } catch (e) {
                    return this.on_dbload_fail();
                }
            }

            // In some rare corner-cases to do with lost internet access,
            // the songs table can be empty - if so then prompt to reinit
            // it.
            rows = await this.single_query('SELECT 1 FROM songs LIMIT 1');
            if (!rows.length)
                // no rows - fail it through
                throw 'No rows in songs table';

            // set fts_table based on what the db has set up, skip any failures
            if (this._should_try_fts()) {
                try {
                    await this.single_query('SELECT 1 FROM fts4 LIMIT 1');
                    this.fts_table = 'fts4';
                } catch (e) {
                    // ignore
                }
                try {
                    await this.single_query('SELECT 1 FROM fts5 LIMIT 1');
                    this.fts_table = 'fts5';
                } catch (e) {
                    // ignore
                }
            }
        } catch (e) {
            console.error(e);
            // Something fundamental failed, user the language selection to recreate the database
            await this._recreate_db();
        }
    }

    async search_meta_sources(search: string, lang: string): Promise<SongSource[]> {
        let query = 'abbreviation LIKE ?';
        let params = [`${search}%`]; // abbrev only at beginning of word

        if (search.length >= 3) {
            query += ' OR searchdata LIKE ? OR searchdata LIKE ?';
            params.push(`${search}%`, `% ${search}%`); // either at beginning or beginning of word
        }

        query = `SELECT * FROM song_source_info WHERE (${query})`;

        if (lang) {
            query += ' AND lang = ?';
            params.push(lang);
        } else query += ' AND lang IN (SELECT DISTINCT lang FROM songs)'; // exclude language databases that were not loaded

        return await this.single_query<SongSource>(query, params);
    }

    async search_meta_albums(search: string, lang: string): Promise<Album[]> {
        let query = `SELECT albums.data
                FROM albums
                WHERE (searchdata LIKE ? OR searchdata LIKE ?)`;
        let params = [`${search}%`, `% ${search}%`]; // either at beginning or beginning of word

        if (lang) {
            query += ' AND lang = ?';
            params.push(lang);
        } else query += ' AND lang IN (SELECT DISTINCT lang FROM songs)'; // exclude language databases that were not loaded

        const rows = await this.single_query<{ data: string }>(query, params);
        return rows.map((row) => JSON.parse(row.data));
    }

    async _search_meta(filters: SearchMetaFilters): Promise<_SearchMetaResult> {
        const [albums, sources] = await Promise.all([
            filters.search.length >= 3 ? this.search_meta_albums(filters.search, filters.lang || '') : Promise.resolve([]),
            this.search_meta_sources(filters.search, filters.lang || ''),
        ]);
        return { albums, sources };
    }

    handle_returned_songs(rows: Record<string, any>[]): Song[] {
        rows.forEach((item) => {
            // expand serialized entries into objects
            ['alternative_titles', 'related_songs', 'info', 'files'].forEach((field) => {
                if (item[field]) item[field] = JSON.parse(item[field]);
            });
        });
        return rows as Song[];
    }

    async get_song(id: number, ajax_fallback = false): Promise<Song | null> {
        if (!id) return null;

        const main_table = this.single_query<any[]>('SELECT * FROM songs WHERE id = ?', [id])
            .then(this.handle_returned_songs)
            .then((res) => (res ? res[0] : null));

        const source_list_lookup = this.single_query<any>(
            `
                SELECT *
                FROM song_source
                JOIN song_source_info ON song_source_info_id = song_source_info.id
                WHERE song_id = ?`,
            [id],
        );
        const albums_lookup = this.single_query<any>(
            `
                SELECT album_songs.*, albums.data AS album
                FROM album_songs
                JOIN albums ON album_id = albums.id
                WHERE song_id = ?`,
            [id],
        ).then((rows) => {
            rows.forEach((row) => (row.album = JSON.parse(row.album)));
            return rows;
        });
        const tags_lookup = this.single_query<{ tag_id: number }>(
            `
                SELECT tag_id
                FROM song_tags
                WHERE song_id = ?`,
            [id],
        ).then((rows) => rows.map((row) => row.tag_id));

        // If we are loading a song that we really want to load ie we would
        // fallback to ajax load it if it wasnt in the database, then mark as a
        // proper view
        if (ajax_fallback) {
            await this.rw_trans((exec) => {
                exec(
                    ['INSERT OR IGNORE INTO usage_stat(song_id, last_view, total_views) VALUES (?,?,?)', [id, 0, 0]],
                    ['UPDATE usage_stat SET last_view = ?, total_views = total_views + 1 WHERE song_id = ?', [Date.now(), id]],
                );
            });
        }

        const [song, song_sources, tags, albums] = await Promise.all([main_table, source_list_lookup, tags_lookup, albums_lookup]);
        if (song) {
            song.sources = song_sources;
            song.tags = tags;
            song.albums = albums;
            return song;
        }

        if (!ajax_fallback) return null;

        return await this.refresh_song_from_db(id);
    }

    _prepare_query(_filters: DBFilters): DBQuery {
        let q: DBQuery = {
            from: 'FROM songs',
            where: '1=1',
            params: [],
            order_by: _filters.order_by,
            order_params: [],
            fallback_fetch: [],
        };
        let search = _filters.search;
        let filters: Partial<DBFilters> = { ..._filters }; // copy so we can manipulate it
        delete filters.search;
        delete filters.order_by;
        let default_order_by = !q.order_by || q.order_by == 'default';

        // Add =? or IN (?,?...) and append the object to parameters for the query
        const add_item = (obj: Array<string | number> | string | number): string => {
            if (typeof obj === 'string' || typeof obj === 'number') {
                q.params.push(obj);
                return '=?';
            } else if (Array.isArray(obj)) {
                q.params.push(...obj);
                return ' IN (' + obj.map(() => '?').join(',') + ')';
            }
            throw 'Invalid type for add_item';
        };

        const title_order_by = 'sort_title ASC, title ASC';
        if (default_order_by) {
            if (search.length) {
                q.order_by = title_order_by;
            } else if (filters.source_id) {
                // put all no song numbers to the end, then order by song number and then title
                q.order_by = 'song_source.number IS NULL, song_source.number ASC,' + title_order_by;
            } else if (filters.album_id) {
                q.order_by = 'album_songs.track ASC,' + title_order_by;
                // Force the specific source id to get proper ordering
                q.where += ' AND album_songs.album_id ' + add_item(filters.album_id.split(/,/));
            } else if (search.length == 0) q.order_by = 'song_usage DESC,' + title_order_by;
        } else {
            if (q.order_by == 'song_source.number asc') {
                q.order_by += ',' + title_order_by;

                // ensure we only display those with numbers when no source_id
                // filter specified
                q.where += ' AND song_source.number';
            }
        }

        if (search.length == 0) {
            // Don't worry if we have incomplete songxml; should be put to the bottom anyway
            //where += ' AND LENGTH(songxml) > 30';     // may be like <verse><br /></verse>
        } else if (/^\s*(i\d+[\s,]+)+$/.test(search + ' ')) {
            let song_ids = search.match(/\d+/g);
            if (song_ids) {
                q.where += ' AND songs.id IN ' + _generate_in_placeholders(song_ids.length);
                q.params = q.params.concat(song_ids);
                filters = {}; // kill filters when searching for specific id
                q.fallback_fetch = song_ids;
            }
        } else if (/\D/.test(search)) {
            // Handle wildcards
            let like_search = search.replace(/\*/g, '%').replace(/\./g, '_');

            // Order by title beginning matches first, then titles
            // alphabetically. Can't do a LIKE against title as it probably
            // contains Turkish chars so wouldn't work properly. This
            // depends on search_title starting with the song title.
            if (default_order_by) {
                q.order_by = '( songs.search_title LIKE ? OR COALESCE(songs.alternative_search_titles LIKE ?, 0) ) DESC, ' + q.order_by;
                q.order_params = [`${like_search}%`, `%"${like_search}%`];
            }

            // We are searching full chunks of text so include %s at either end
            if (this.fts_table) {
                q.from += ` JOIN ${this.fts_table} AS fts ON fts.rowid = songs.id`;
                q.where += ` AND fts.${this.fts_table} MATCH ?`; // special column name of the table that matches all columns

                // TODO: Could do some nice NEAR() queries
                if (this.fts_table == 'fts4') {
                    q.params.push(`"${search}*"`);
                } else if (this.fts_table == 'fts5') {
                    // wildcards need to be outside of quotes here
                    let wildcards = search.split(/\*/);
                    wildcards.push(''); // last term always a wildcard
                    q.params.push(wildcards.map((term) => `"${term}"`).join('* '));
                }
            } else {
                q.where +=
                    ' AND ( songs.search_title LIKE ? OR songs.alternative_search_titles LIKE ? OR songs.search_text LIKE ? OR songs.search_meta LIKE ? )';
                let a = `%${like_search}%`;
                q.params.push(a, a, a, a);
            }
        } else {
            // song number
            q.where += ' AND songs.id IN ( SELECT song_id FROM song_source WHERE number = ? )';
            q.params.push(search);
        }

        if (/^album_songs\.track/.test(q.order_by)) {
            // NOTE: This will strip any songs that dont have a track
            q.from += ' JOIN album_songs ON songs.id = album_songs.song_id';
        } else if (/^song_source/.test(q.order_by)) {
            // NOTE: This may produce some songs multiple times (if they have
            // multiple references).
            q.from += ' JOIN song_source ON songs.id = song_source.song_id';
        } else if (/^usage_stat\./.test(q.order_by)) {
            q.from += ' JOIN usage_stat ON songs.id = usage_stat.song_id';
        } else if (/sort_title/i.test(q.order_by)) {
            // Sort title may be the same but titles different so sort
            // determanistically according to that
            q.order_by = q.order_by.replace(/(sort_(title[^,]*))/gi, '$1, $2');
        }

        if (filters.advanced_tags) {
            // Expects an object
            for (const [tag_id, val] of Object.entries(filters.advanced_tags)) {
                q.where += ' AND ' + (val ? '' : 'NOT ') + 'EXISTS ( SELECT 1 FROM song_tags WHERE song_id = songs.id AND tag_id = ? )';
                q.params.push(tag_id);
            }
            delete filters.advanced_tags;
        }
        if (filters.album_id) {
            q.where += ' AND songs.id IN ( SELECT song_id FROM album_songs WHERE album_id ' + add_item(filters.album_id.split(/,/)) + ' )';
            delete filters.album_id;
        }
        if (filters.source_id) {
            q.where += ' AND songs.id IN ( SELECT song_id FROM song_source WHERE song_source_info_id ' + add_item(filters.source_id.split(/,/)) + ' )';
            delete filters.source_id;
        }

        for (const [key, obj] of Object.entries(filters)) {
            if (obj === undefined)
                // as per tristate
                continue;

            let val = obj as string;
            if (key == 'songkey') {
                q.where += ' AND LOWER(' + key + ')';
                val = val.toLowerCase();
            } else q.where += ' AND ' + key;

            q.where += add_item(val);
        }

        return q;
    }

    async _get_total(q: { from: string; where: string; params: BindParams }): Promise<number> {
        const rows = await this.single_query<{ total: number }>(`SELECT COUNT(*) AS total ${q.from} WHERE ${q.where}`, q.params);
        return rows[0].total;
    }

    async _run_search(q: DBQuery, pager: DBRequestedItems): Promise<DBSearchRunResult> {
        // Full sql statement now
        // select * can be slow on mobiles so dont fetch everything
        let sql =
            `SELECT songs.id, songs.lang, songs.alternative_titles, songs.copyright_restricted, songs.title, songs.source_title, songs.is_original,
                        songs.has_chord, songs.has_mp3, songs.has_sheet, songs.year, songs.songkey, songs.info` +
            ` ${q.from} WHERE ${q.where} ORDER BY ${q.order_by} LIMIT ${pager.start},${pager.size}`;

        let params = [...q.params, ...q.order_params];
        console.log(sql, params);

        const rows = await this.single_query<any[]>(sql, params);

        if (!rows.length && q.fallback_fetch && q.fallback_fetch.length) {
            // If searching by IDs then try to get them directly from
            // the server if possible...
            const results = await this.refresh_songs_from_db(q.fallback_fetch.map(Number));
            return { data: results.filter((s): s is Song => !!s) };
        }

        return { data: this.handle_returned_songs(rows) };
    }

    async _get_songs(ids: number[], ajax_fallback?: boolean): Promise<Song[]> {
        // Full sql statement now
        // select * can be slow on mobiles so dont fetch everything
        const do_query = () => {
            let sql =
                `SELECT songs.id, songs.lang, songs.alternative_titles, songs.copyright_restricted, songs.title, songs.source_title, songs.is_original,
                            songs.has_chord, songs.has_mp3, songs.has_sheet
                        FROM songs` +
                ' WHERE id IN ' +
                _generate_in_placeholders(ids.length);

            return this.single_query<any>(sql, ids);
        };

        const rows = await do_query();
        if (!ajax_fallback || rows.length == ids.length) return this.handle_returned_songs(rows);

        // If we had the fallback specified and we didn't get all the
        // songs then try to load them from the internet & re-issue the
        // query. If not connected to the internet etc this will fail
        // but let's at least try to do it.

        // first let's get a list of missing ids
        let missing_ids: { [id: number]: 1 } = {};
        ids.forEach((id) => (missing_ids[id] = 1));
        for (let i = 0; i < rows.length; i++) delete missing_ids[rows[i].id];

        await this.refresh_songs_from_db(Object.keys(missing_ids).map((id) => parseInt(id)));
        return this.handle_returned_songs(await do_query());
    }

    // Update the (cached) favourite setting - FAVOURITE_DB is authoritative
    // but to allow filtering we need to store it here.
    async set_favourite(song_id: number, value: 1 | 0): Promise<void> {
        await this.single_query('UPDATE songs SET favourite = ? WHERE id = ?', [value, song_id], true);
    }

    async get_tag_counts(): Promise<{ [id: number]: number }> {
        return this.single_query<{ tag_id: number; total: number }>('SELECT tag_id, COUNT(*) AS total FROM song_tags GROUP BY tag_id').then((rows) =>
            rows.reduce(
                (acc, row) => {
                    acc[row.tag_id] = row.total;
                    return acc;
                },
                {} as { [id: number]: number },
            ),
        );
    }

    async get_song_sources(): Promise<SongSource[]> {
        return this.single_query<SongSource>(
            'SELECT * FROM song_source_info WHERE lang IN (SELECT DISTINCT lang FROM songs)', // exclude language databases that were not loaded
        );
    }

    // Nuke the DB so that the app resets itself
    async kill_db(): Promise<void> {
        await this.rw_trans((exec) => {
            exec(['drop table if exists version'], ['drop table if exists songs']);
        });
        // TODO: In sqlite-wasm close the db?
    }
}
