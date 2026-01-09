import { on_db_languages_update } from '../db';
import { send_error_report } from '../error-catcher';
import type { FavouriteDB } from '../favourite-db';
import { get_db_path } from '../globals';
import { persistentStorage } from '../persistent-storage.es5';
import { Song } from '../song';
import { load_song_languages, refresh_song_languages } from '../song-languages';
import { CommonDB, get_db_chosen_langs } from './common';
import { OnlineDB } from './online';

type ProgressTracker = (progress: number) => void;

type LangPackExtra = Record<string, unknown>;

export interface LangPackResponse extends LangPackExtra {
    data?: Song[];
    compressed?: boolean;
    total?: number;
    song_source_info?: Array<Record<string, unknown>>;
    albums?: Array<Record<string, unknown>>;
}

// Track the progress of a fetch request
const track_progress = (callback_fn: (read: number, total: number) => void) => {
    // Not supported; abort
    if (typeof window.Response == 'undefined' || typeof window.ReadableStream == 'undefined') return (res: Response) => res;

    return (response: Response) => {
        const { body, headers, status } = response;
        if (!body) return response;

        // The full length requires size to be sent from server, which it is
        // not with gzipped files. The bytes read is actually uncompressed so
        // if we could make the server send the actual (uncompressed) file size
        // we could have a good percentage here.
        const contentLength = headers.get('content-length');
        const totalLength = contentLength ? parseInt(contentLength, 10) : 0;
        const reader = body.getReader();
        let read = 0;
        const stream = new window.ReadableStream<Uint8Array>({
            start(controller) {
                function push() {
                    reader.read().then(({ done, value }) => {
                        if (done) {
                            controller.close();
                            return;
                        }
                        if (value) {
                            read += value.length;
                            callback_fn(read, totalLength);
                        }
                        controller.enqueue(value);
                        push();
                    });
                }

                push();
            },
        });
        return new window.Response(stream, { headers, status });
    };
};

// Base class for offline database implementations
export abstract class OfflineDBCommon extends CommonDB {
    MAX_DB_AGE = 60 * 60 * 24 * 7 * 1000; // update db every week
    _type = 'offline';
    online_db: OnlineDB;
    _offline_type!: string;
    DB_VERSION!: number;
    _last_update_key!: string;

    abstract list_loaded_langs(): Promise<string[]>;

    constructor(favorite_db: FavouriteDB) {
        super(favorite_db);
        // Create an instance of the online db to allow us to fallback to loading songs from the server if they are outside
        // of our users selected language remit
        this.online_db = new OnlineDB(favorite_db);
    }

    async on_dbload_fail() {
        // TODO $.mobile.changePage('#page-dbload-failed', { reverse: false, changeHash: false });
    }

    full_type(): string {
        return `${this._type}-${this._offline_type}`;
    }

    get_version_string(): string {
        const last_update = persistentStorage.get(this._last_update_key) ?? '';
        return `${this._type} (${this._offline_type}) db version: ${this.DB_VERSION}. DB Last updated: ${last_update}`;
    }

    async _populate_db(in_background: boolean, progress_tracker?: ProgressTracker): Promise<void> {
        const languages_to_load = get_db_chosen_langs();
        if (!languages_to_load.length) throw 'No languages to load selected';

        const cur_langs = await this.list_loaded_langs();

        // Try to be efficient and only add / remove certain languages rather than redoing the whole
        // database. A language that is already loaded does not need to be re-added.
        const to_add = languages_to_load.filter((lang) => !cur_langs.includes(lang));
        const to_remove = cur_langs.filter((lang) => !languages_to_load.includes(lang));

        const promises: Promise<void>[] = [];
        if (to_add.length)
            // Add any new languages in but without nuking the existing database
            promises.push(this.add_languages(to_add, in_background, progress_tracker));

        if (to_remove.length)
            // Remove any from db that were not in languages_to_load
            promises.push(this.remove_languages(to_remove));

        await Promise.all(promises);
    }

    async remove_languages(langs: string[]): Promise<void> {
        const last_update = persistentStorage.getObj<Record<string, number>>(this._last_update_key, {});
        for (const lang of langs) {
            const emptyPack: LangPackResponse = { data: [] };
            await this._populate(emptyPack, lang, false, undefined);

            delete last_update[lang];
            persistentStorage.setObj(this._last_update_key, last_update);
        }
    }

    // TODO: Run on worker thread if possible (eg sqlite-wasm)
    async add_languages(languages: string[], in_background?: boolean, progress_tracker?: ProgressTracker): Promise<void> {
        const download_promises: Promise<unknown>[] = [];

        let start_ts = Date.now();
        console.log('Adding the following languages to the database', in_background ? 'in background' : 'in foreground', languages);

        // Download all the required files

        // Make sure that our translations are up to date - may not have been
        // initiated here by the user (ie background update).
        download_promises.push(refresh_song_languages());

        const langs = (load_song_languages(true) as Record<string, { size?: number; count?: number }>) || {};

        // TODO: This could be abstracted out into a class if wanted to be used elsewhere
        const ROW_PROGRESS_FACTOR = 2; // how long does row import take after the download
        const sum = (a: Array<number | undefined>): number => a.reduce<number>((a, b) => (a || 0) + (b || 0), 0);

        const total_expected = sum(languages.map((lang) => langs[lang]?.size)) * ROW_PROGRESS_FACTOR;
        const totalDone: Record<string, number> = {};
        const STEP_DOWNLOAD = 1,
            STEP_DOWNLOAD_COMPLETE = 2,
            STEP_IMPORT = 3;
        const update_loaded_status = (lang: string, step: number, size: number) => {
            if (!progress_tracker || total_expected == 0) return;

            if (step == STEP_DOWNLOAD) totalDone[lang] = size;
            else if (step == STEP_DOWNLOAD_COMPLETE) totalDone[lang] = langs[lang]?.size || 0;
            else if (step == STEP_IMPORT) totalDone[lang] = (langs[lang]?.size || 0) * (1 + size * (ROW_PROGRESS_FACTOR - 1));

            const overall_perc = sum(Object.values(totalDone)) / total_expected;
            if (overall_perc > 0 && overall_perc <= 1) progress_tracker(overall_perc);
        };

        // Now download each language pack and add it to the database as it
        // comes in. Do this in a small array to ensure that we don't need to
        // cache 30 langpacks in memory while the database struggles to keep
        // up.
        // TODO: Make this by rough number of songs expected to be backlogged in the queue (on mobile devices). This also slows down desktop devices
        let download_errors = 0;
        const download_lang = async (lang: string, required?: boolean): Promise<void> => {
            const ret: LangPackResponse = await fetch(`${get_db_path()}.${lang}.json`, { cache: 'no-store' })
                .then(track_progress((read) => update_loaded_status(lang, STEP_DOWNLOAD, read)))
                .then((response) => response.json() as Promise<LangPackResponse>);

            console.log(`Adding lang ${lang} to database`, ret.data ? `${ret.data.length} entries` : '');

            update_loaded_status(lang, STEP_DOWNLOAD_COMPLETE, 0);

            // TODO: If rejected with a permiment issue (eg out of space) then skip and downgrade to OnlineDb
            try {
                const lang_start_ts = Date.now();
                await this._populate(ret, lang, true, (count, total) => {
                    if (count % 100 == 0) update_loaded_status(lang, STEP_IMPORT, count / total); // perc through
                });

                console.log(`Completed adding lang ${lang} to db in ${Date.now() - lang_start_ts}ms`);

                const last_update = persistentStorage.getObj<Record<string, number>>(this._last_update_key, {});
                last_update[lang] = Date.now();
                persistentStorage.setObj(this._last_update_key, last_update);
            } catch (err) {
                download_errors++;
                if (required) {
                    console.error(err);
                    throw err;
                }

                console.log(`Loading lang ${lang} to database failed.. skipping`, err);
            }
        };

        const maybe_download_lang = async () => {
            const lang = languages.pop();
            if (!lang) return;
            await download_lang(lang);
            update_loaded_status(lang, STEP_IMPORT, 1);
            await maybe_download_lang(); // Recurse back to itself to see if anything more needs loading
        };

        // To reduce stutter on android etc just do the langpack refresh in series
        const max_parallel_langpacks = in_background ? 1 : 10;

        // Reorder languages so that we get the largest first to hopefully improve overall speed
        languages.sort((a, b) => ((langs[b] || {}).count || 0) - ((langs[a] || {}).count || 0));

        // start a number of 'worker processes' (actually all in the main
        // thread) to download and install the databases to this device.
        const to_download = languages.length;
        for (let i = 0; i < max_parallel_langpacks; i++) download_promises.push(maybe_download_lang());

        await Promise.all(download_promises);

        if (download_errors / to_download > 0.3) throw 'Too many langpacks failed to download';

        console.log(`database initialized as version ${this.DB_VERSION} in ${Date.now() - start_ts}ms`);

        // Refresh the search boxes and anything else if needed
        this._invalidate_queries();
        on_db_languages_update.next();
    }

    async _populate(
        to_import: LangPackResponse,
        lang_code: string,
        is_compressed: boolean,
        rows_loaded_callback?: (count: number, total: number) => void,
    ): Promise<void> {
        try {
            if (lang_code == 'dbmeta') await this._populate_dbmeta(to_import);
            else await this._populate_lang(to_import, lang_code, is_compressed, rows_loaded_callback);
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            send_error_report('populate-db', error, { msg: errMsg, lang: lang_code });

            console.error('populate db failed:', error);
            throw error;
        }
    }

    // This will just go through and do the db update in the background.
    // TODO: Run on worker thread if possible (eg sqlite-wasm)
    async refresh_languages(in_background?: boolean, force?: boolean, progress_tracker?: ProgressTracker): Promise<void> {
        let langs = [...get_db_chosen_langs()];
        langs.push('dbmeta'); // this needs periodic refreshing also

        // Only update once a week or something if we are not being forced
        if (!force) {
            const last_update_lang = persistentStorage.getObj<Record<string, number>>(this._last_update_key, {});
            const ts = Date.now();
            langs = langs.filter((lang) => ts - (last_update_lang[lang] || 0) > this.MAX_DB_AGE);
        }

        if (langs.length) await this.add_languages(langs, in_background, progress_tracker);
    }

    // Update a song from the server, or even potentially a new one if add_song is called with ajax_fallback set
    async refresh_song_from_db(id: number): Promise<Song | null> {
        if (!id) throw 'No id specified';

        const fetched_song = await this.online_db.get_song(id, false, true);
        if (!fetched_song) throw 'Failed to get song';

        // Add it to the database to cache for future uses
        await this.add_song(fetched_song);

        // Load from db with no fallback this time. Can't just return
        // the song from ajax as it may be missing source or tag info
        return await this.get_song(id);
    }

    async _refresh_song_from_db_no_err(id: number): Promise<Song | null> {
        try {
            return await this.refresh_song_from_db(id);
        } catch (e) {
            // Turn any failures into null returns so we only complete the
            // when when all have completed (otherwise Promise.all returns on
            // first failure)
            return null;
        }
    }
    async refresh_songs_from_db(ids: number[]): Promise<(Song | null)[]> {
        return await Promise.all(ids.map((songId) => this._refresh_song_from_db_no_err(songId)));
    }

    // Abstract methods that subclasses must implement
    abstract _populate_dbmeta(data: LangPackResponse): Promise<void>;

    abstract _populate_lang(
        data: LangPackResponse,
        lang_code: string,
        is_compressed: boolean,
        rows_loaded_callback?: (count: number, total: number) => void,
    ): Promise<void>;

    abstract add_song(song: Song): Promise<void>;
}

// TODO: Remove this fn
export function is_offline_db(db: CommonDB): db is OfflineDBCommon {
    return db.type() === 'offline';
}
