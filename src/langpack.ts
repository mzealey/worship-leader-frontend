import LANGPACK_INDEX from '../langpack/index.json';
import { BUILD_TYPE, DEBUG } from './globals';
import { refresh_selectmenu } from './jqm-util';
import { JQueryPage } from './song';
import { song_language_translations } from './song-languages';
import { LOCALE_SORT } from './sort-helpers';
import { deferred_promise, fetch_json, is_rtl } from './util';

// Currently active language translation pack
let translations: Record<string, string | Record<string, string>> = {};
let _app_lang; // should be set to the current language of the app

// Now try to load the current translation language pack for this setup
const [_langpack_loaded, _langpack_loaded_promise] = deferred_promise<void>();
export function langpack_loaded() {
    return _langpack_loaded_promise;
}
export function app_lang() {
    return _app_lang;
}
let _langpack_loaded_resolved = 0;
_langpack_loaded_promise.then(() => (_langpack_loaded_resolved = 1));

// Load a language pack
export async function _lang_setup(lang = 'en') {
    _app_lang = lang || 'en';

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
            new_translation = await fetch_json<Record<string, unknown>>(`langpack/${_app_lang}.json`); //, has_service_worker || BUILD_TYPE != 'www' ? { cache: 'no-cache' } : {});

        // Test mode override whene we don't have this set - in prod builds it should be set for all langpacks
        if (!('langpack_direction' in new_translation)) new_translation['langpack_direction'] = 'ltr';

        Object.assign(translations, new_translation);
        _langpack_loaded.resolve();
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
        try {
            $('#langpack-not-loaded').popup('open', { history: false });
        } catch (e) {
            // may happen that the app did not load fully yet
        }
        */

        // We should have the en language pack always available - if not, major issues.
        if (lang != 'en') await _lang_setup('en');
    }
}

export async function lang_setup(lang = 'en') {
    await _lang_setup(lang);

    // JQM-specific stuff

    // Get the special string saying the direction of the language pack
    $('html, body').attr({
        dir: get_translation('langpack_direction'),
        lang: _app_lang,
    });

    relocalize_page($('body'));
    return _app_lang;
}

type TranslationContext = unknown;

export function get_translation(name: string, e?: TranslationContext) {
    if (/^lang\./.test(name)) return lang_name(name.replace(/^lang\./, ''));
    const parts = name?.split('.');
    const value = parts?.length == 2 ? translations[parts[0]][parts[1]] : parts ? translations[parts[0]] : undefined;

    if (DEBUG && _langpack_loaded_resolved && !value) {
        console.log('No translation found for ', name, e || 'no element passed');
        return `XXX NO TRANSLATION (${name}) XXX`; // debug only
    }

    return typeof value === 'string' ? value : '';
}

// Return the localized name of a language code
export function lang_name(lang_id: string) {
    // The data fetched from the server should always be up to date and more
    // correct than the language pack distributed with this app build.
    let langs = song_language_translations();
    if (langs && langs[lang_id] && langs[lang_id]?.name?.[_app_lang]) return langs[lang_id].name[_app_lang];

    // Fallback to our inbuilt translation or just the language id by itself
    const lang_names = translations?.language_names as Record<string, string> | undefined;
    return translations && lang_names && lang_names[lang_id] ? lang_names[lang_id] : lang_id;
}

export function relocalize_page(page: JQueryPage) {
    // NOTE: Doesn't change the title until the next load of the page (see pagebeforeshow below)
    page.find('[data-title-localize]').each((i, e) => {
        e = $(e);
        e.attr('title', get_translation(e.attr('data-title-localize'), e));
    });

    page.find('[data-placeholder-localize]').each((i, e) => {
        e = $(e);
        e.attr('placeholder', get_translation(e.attr('data-placeholder-localize'), e));
    });

    page.find('[data-localize]').each((i, e) => {
        e = $(e);
        let translation = get_translation(e.attr('data-localize'), e);

        e.html(translation); // note .html is required for allowing <> tags etc in the translation
        e.attr('title', translation);

        if (e.is('option')) refresh_selectmenu(e.parent());
    });

    // Reorder the language list which is dynamic:
    page.find('.filter-language').each((i, e) => {
        e = $(e);
        e.find('option.reorderable')
            .sort((a, b) => LOCALE_SORT($(a).text(), $(b).text()))
            .appendTo(e);
    });
}

export function sorted_language_codes(languages: string[]) {
    languages.sort((a, b) => LOCALE_SORT(lang_name(a), lang_name(b)));

    return languages;
}

export function get_language_options() {
    // Order the list
    let languages = Object.keys(LANGPACK_INDEX);
    languages.sort((a, b) => LOCALE_SORT(LANGPACK_INDEX[a], LANGPACK_INDEX[b]));

    let options = languages.map((key) =>
        $('<option>')
            .attr({ value: key, dir: is_rtl(LANGPACK_INDEX[key]) ? 'rtl' : 'ltr' })
            .text(LANGPACK_INDEX[key]),
    );

    return Promise.resolve(options);
}
