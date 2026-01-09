import { getSetting } from './settings-store';
import { gup } from './splash-util.es5';

// Get languages to try for ui language packs in order of preference. Should
// always include at least one valid language. This needs to be instant (ie
// cannot use ajax) as it is used to influence the splash screen.
export function get_browser_languages(extra?: string[]) {
    let languages: string[] = [];

    let add_lang = function (...args: (string | undefined | null)[]) {
        for (let i = 0; i < args.length; i++) {
            let lang = args[i];
            if (lang && languages.indexOf(lang) == -1) languages.push(lang);
        }
    };

    // First see if user specified anything in the app or from url
    add_lang(gup('lang'));
    add_lang(getSetting('lang'));

    // TODO: Perhaps get something from cordova perhaps using
    // https://github.com/apache/cordova-plugin-globalization? But probably the
    // web browser setting is good enough.

    // Specific subdomains
    if (/^http/.test(window.location.protocol) && /^ilahiler/.test(window.location.host)) add_lang('tr');

    // Try to figure it out from the browser itself
    const nav = navigator as Navigator & { userLanguage?: string; languages?: string[] };
    let browser_languages: Array<string | undefined> = [nav.language /* Mozilla */ || nav.userLanguage /* IE */];

    try {
        if (nav.languages) browser_languages = browser_languages.concat(nav.languages);
    } catch (e) {
        // ignore any errors - unsupported browser etc
    }

    // List of languages that should be forced to a different UI so they don't default to English
    // Taken from https://www.loc.gov/standards/iso639-2/php/code_list.php
    //
    // Probably worth making it match the list in util/build_langpack.pl
    const lang_code_map: Record<string, string> = {
        ku: 'kmr',

        hy: 'ru', // Armenian
        az: 'ru', // Azerbaijani
        ab: 'ru', // Abkhazian
        be: 'ru', // Belarus
        bg: 'ru', // Bulgarian
        ce: 'ru', // Chechen
        ka: 'ru', // Georgian
        ky: 'ru', // Kyrgyz
        tt: 'ru', // Tatar
        tg: 'ru', // Tajik
        tk: 'ru', // Turkmen
        ug: 'ru', // Uighur
        uk: 'ru', // Ukrainian
        uz: 'ru', // Uzbek (end)
    };

    browser_languages.forEach(function (lang) {
        if (lang) {
            add_lang(lang); // eg en-GB
            add_lang(lang, lang_code_map[lang]);

            lang = lang.toLowerCase().slice(0, 2); // eg en
            add_lang(lang, lang_code_map[lang]);
        }
    });

    if (extra) extra.forEach((lang) => add_lang(lang));

    return languages;
}

export function get_app_languages(): string[] {
    return get_browser_languages(['en']); // en as always final fallback
}
