import { get_db_path } from './globals';
import { get_app_languages } from './langdetect.es5';
import { persistentStorage } from './persistent-storage.es5';
import { fetch_json } from './util';

// Start by trying to load the song language language pack from persistent storage, otherwise the remote server

// Holds song_language => { name: { ui_language => name, ... }, count: <db_total> }
let _song_language_translations: Record<string, SongLanguage> | undefined;
export function song_language_translations(): Record<string, SongLanguage> | undefined {
    return _song_language_translations;
}

// Timestamp and promise of the last request to load the list of song languages
let _song_languages_last_load: number | undefined;
let _song_languages_last_promise: Promise<Record<string, SongLanguage>> | undefined;

interface SongLanguage {
    // TODO: Add the other fields
    count: number;
    name?: Record<string, string>;
}

// Return a list of song languages available on the server, with their
// translations.
export function refresh_song_languages(): Promise<Record<string, SongLanguage>> {
    // Don't continually hit the server, but refetch when the app has been
    // restarted if requested via this method
    if (_song_languages_last_load && _song_languages_last_load - Date.now() < 3600 * 1000 && _song_languages_last_promise) return _song_languages_last_promise;

    _song_languages_last_promise = undefined;

    // If we are in a live build then see if we had song language db injected
    if (BUILD_TYPE == 'www') {
        let elem = document.getElementById(`json-song_lang_db`);
        if (elem) _song_languages_last_promise = Promise.resolve(JSON.parse(elem.innerHTML));
    }

    if (!_song_languages_last_promise) _song_languages_last_promise = fetch_json(`${get_db_path()}.index.json`, { cache: 'no-store' });

    _song_languages_last_promise = _song_languages_last_promise.then((song_languages: Record<string, SongLanguage>) => {
        _song_language_translations = song_languages;
        _song_languages_last_load = Date.now();
        persistentStorage.setObj('song-languages', song_languages);
        return song_languages;
    });
    return _song_languages_last_promise!;
}

// Just try to load the song language translations from the current cache on
// startup. If we want to refresh the song database etc then we call
// refresh_song_languages() above
export function load_song_languages(no_wait: true): Record<string, SongLanguage> | undefined;
export function load_song_languages(no_wait?: false): Promise<Record<string, SongLanguage>> | undefined;
export function load_song_languages(no_wait?: boolean): Record<string, SongLanguage> | Promise<Record<string, SongLanguage>> | undefined {
    if (!_song_language_translations) {
        const trans = persistentStorage.getObj('song-languages') as Record<string, SongLanguage> | undefined;
        if (trans) _song_language_translations = trans;
    }

    if (_song_language_translations) return no_wait ? _song_language_translations : Promise.resolve(_song_language_translations);

    if (!no_wait) return refresh_song_languages();
}

// Return a default list of potential DB languages for this user based on their
// language settings. Instant return, no promises allowed.
export function get_default_db_languages(): string[] {
    const db_languages = load_song_languages(true) || { en: { count: 1 } };
    return get_app_languages().filter((lang) => !!db_languages[lang]);
}
