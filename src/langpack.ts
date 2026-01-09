import { create } from 'zustand';
import { send_ui_notification } from './component/notification';
import { updateSetting } from './settings-store';
import { song_language_translations } from './song-languages';
import { LOCALE_SORT } from './sort-helpers';
import { fetch_json } from './util';

// Currently active language translation pack
let translations: Record<string, unknown> = {};

// Load a language pack
async function lang_setup(lang = 'en') {
    const new_lang = lang || 'en';

    // If we are in a live build then see if we previously had the correct langpack injected
    let new_translation: Record<string, unknown> | undefined;
    if (BUILD_TYPE == 'www') {
        let elem = document.getElementById(`json-langpack-${lang}`);
        if (elem) new_translation = JSON.parse(elem.innerHTML);
    }

    try {
        // force reload when www client to get latest data. Service worker should do this for us automatically anyway
        if (!new_translation)
            // TODO: force reload when www client to get latest data. Service worker should do this for us automatically anyway
            new_translation = await fetch_json<Record<string, unknown>>(`langpack/${new_lang}.json`); //, has_service_worker || BUILD_TYPE != 'www' ? { cache: 'no-cache' } : {});

        // Test mode override whene we don't have this set - in prod builds it should be set for all langpacks
        if (!('langpack_direction' in new_translation)) new_translation['langpack_direction'] = 'ltr';

        Object.assign(translations, new_translation);

        // Get the special string saying the direction of the language pack
        // TODO: React-ify this stuff
        [document.documentElement, document.body].map((e) => {
            e.setAttribute('dir', get_translation('langpack_direction'));
            e.setAttribute('lang', new_lang);
        });
    } catch (_e) {
        // file not found. The only case when this could potentially happen is
        // if we are a webapp running offline and someone goes to an uncached
        // language. English will always be cached from the service-worker.
        //
        // But it appears that we are getting this in some spiders or the
        // occasional samsung browser where there is no error defined. I saw
        // this once on a device where I hit the stop button half way through
        // the loading process, which I guess can cancel xhr requests.
        /*
        send_error_report('langpack-no-load', undefined, {
            lang: _app_lang,
            http: { status: http_err.status, text: http_err.statusText },
            connection: navigator.onLine ? 'online' : 'offline',
            f: `langpack/${_app_lang}.json`,
        });
        */
        send_ui_notification({ message_code: 'langpack-not-loaded' });

        // We should have the en language pack always available - if not, major issues.
        if (lang != 'en') return await lang_setup('en');
    }
    return new_lang;
}

interface AppLangState {
    appLang: string | undefined;
    setLanguage: (lang: string) => Promise<void>;
}

export const useAppLang = create<AppLangState>((set) => ({
    appLang: undefined,
    setLanguage: async (lang) => {
        set({ appLang: await lang_setup(lang) });
        updateSetting('lang', lang);
    },
}));

type TranslationContext = unknown;

export function get_translation(name: string, e?: TranslationContext) {
    if (/^lang\./.test(name)) return lang_name(name.replace(/^lang\./, ''));

    if (DEBUG && !(name in translations)) {
        console.log('No translation found for ', name, e || 'no element passed');
        return `XXX NO TRANSLATION (${name}) XXX`; // debug only
    }

    const value = translations[name];
    return typeof value === 'string' ? value : '';
}

// Return the localized name of a language code
function lang_name(lang_id: string) {
    // The data fetched from the server should always be up to date and more
    // correct than the language pack distributed with this app build.
    let langs = song_language_translations();
    const { appLang } = useAppLang.getState();

    if (appLang && langs?.[lang_id].name?.[appLang]) return langs[lang_id].name[appLang];

    // Fallback to our inbuilt translation or just the language id by itself
    const languageNames = translations['language_names'] as Record<string, string> | undefined;
    return languageNames?.[lang_id] ?? lang_id;
}

function sorted_language_codes(languages: string[]) {
    languages.sort((a, b) => LOCALE_SORT(lang_name(a), lang_name(b)));

    return languages;
}

export function useTranslation() {
    // This should trigger a re-render whenever the language changes
    useAppLang();

    return {
        t: get_translation,
        lang_name,
        sorted_language_codes,
    };
}
