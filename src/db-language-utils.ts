import { DB_AVAILABLE } from './db';
import { get_db_chosen_langs } from './db/common';
import { send_error_report } from './error-catcher';
import { get_client_type, get_host, get_uuid, is_firsttime } from './globals';
import { get_default_db_languages, refresh_song_languages } from './song-languages';
import { unidecode } from './unidecode';
import { fetch_json, generate_search_params } from './util';

export interface DbLangEntry {
    code: string;
    position: 'top' | 'bottom';
    selected: boolean;
    count: number;
    unidecoded: string;
}

export async function getDbLangs({
    alreadySetup,
    lang_name,
}: {
    alreadySetup: boolean;
    lang_name: (code: string) => string;
}): Promise<DbLangEntry[] | undefined> {
    // Get and set up available language selections
    async function get_all_langs(): Promise<DbLangEntry[]> {
        const available_langs = await refresh_song_languages();
        if (!Object.keys(available_langs).length) return Promise.reject();

        if ('onLine' in navigator && !navigator.onLine) return Promise.reject();

        let ret: DbLangEntry[] = [];
        for (const [code, info] of Object.entries(available_langs)) {
            ret.push({
                code,
                position: 'bottom',
                selected: false,
                count: info.count,
                unidecoded: await unidecode(lang_name(code).toLowerCase()),
            });
        }
        return ret;
    }

    let defaults: Set<string> = new Set(get_default_db_languages());

    // Additional languages that should be near the top as they are typical in
    // this country (gotten from the server based on our IP address)
    let data = {
        uuid: get_uuid(),
        client_type: get_client_type(),

        // Was the db already setup (ie this is through settings page) or not yet
        cur_db: alreadySetup ? 1 : 0,
        firsttime: is_firsttime ? 1 : 0,

        // For debug testing...
        //from_ip: '46.173.1.235',          // RU
        //from_ip: '73.140.138.150',          // US
    };

    // 4s timeout to not freeze the page if there is an API issue
    let preferred_langs_promise: Promise<Set<string>> = Promise.race([
        new Promise<Set<string>>((res) => setTimeout(() => res(defaults), 4000)),
        (async () => {
            try {
                const ret = await fetch_json<{ languages?: string[] }>(get_host() + '/api/app/default_language_prefs?' + generate_search_params(data));
                return new Set(ret.languages ?? []);
            } catch (e) {
                return defaults; // in case of connection error/timeout
            }
        })(),
    ]);

    // The current (or default) database languages to load as an array
    let loaded_langs: string[] = get_db_chosen_langs(Array.from(defaults));

    // Combine all the promises together to generate the page with the data
    // they have fetched.
    try {
        const [all_langs, preferred_langs] = await Promise.all([get_all_langs(), preferred_langs_promise]);
        for (const lang of all_langs) {
            if (loaded_langs.includes(lang.code)) lang.selected = true;

            if (preferred_langs.has(lang.code) || lang.selected) lang.position = 'top';
        }
        return all_langs;
    } catch (e) {
        try {
            await DB_AVAILABLE;
            return;
        } catch (e) {
            // If first time (ie db not initialized), then retry a
            // reload as it's essential that we get a database
            // loaded.
            send_error_report('db-init-failed', undefined); // note to us as we probably shouldn't ever get here...
            const db = await DB_AVAILABLE;
            await db.populate_db();
            return;
        }
    }
}
