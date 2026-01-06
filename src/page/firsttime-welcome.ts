import { get_client_type, is_firsttime } from '../globals';
import { refresh_selectmenu } from '../jqm-util';
import { app_lang, get_language_options, lang_setup, langpack_loaded } from '../langpack';
import { persistentStorage } from '../persistent-storage.es5';
import { update_setting } from '../settings';
import { is_bot } from '../splash-util.es5';
import { app_inited, firsttime_shown, firsttime_shown_deferred, jqm_setup } from '../startup-promises';

export function init_firsttime_welcome() {
    const page = $('#firsttime-welcome');
    page.on('pageinit', () => {
        // Need to wait until the langpack has been loaded until we can get the
        // app_lang value properly.
        Promise.all([get_language_options(), langpack_loaded()]).then(
            ([options]) => {
                let select = page.find('select');
                select.append(...options);

                select
                    .change(function () {
                        lang_setup($(this).val() as string);
                        update_setting('setting-lang', app_lang());
                    })
                    .val(app_lang());
                refresh_selectmenu(select);
            },
            () => {
                // couldn't load ?
                page.find('.if-langpack').hide();
            },
        );
    });

    // Ensure we cannot stay on this page after init has completed
    firsttime_shown.then(() => page.on('pagebeforeshow', () => $.mobile.changePage('#page-list')));

    // If the dialog's background, continue button or the close button was clicked then correctly start the app up
    $('body').on('click', '#page-native-prompter, .firsttime-welcome-next, #page-native-prompter .ui-header > .ui-icon-delete', (event) => {
        if (event.target == event.currentTarget)
            // only these targets exactly, not bubbled events
            firsttime_shown_deferred.resolve();
    });

    // Can be installed as a PWA. Usually fires some time after we are all set
    // up though.
    window.addEventListener('beforeinstallprompt', (pwa_prompt) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        pwa_prompt.preventDefault();

        if (BUILD_TYPE != 'www' || get_client_type() != 'www')
            // only on web version (not app etc)
            return;

        if (get_app_dl_link())
            // native app available
            return;

        if (!should_show_prompt())
            // showed prompt too recently
            return;

        app_inited.then(() => show_pwa_prompt(pwa_prompt));
    });

    jqm_setup.then(() => {
        if (!need_to_show_firsttime_welcome_message()) firsttime_shown_deferred.resolve();
    });
}

function show_pwa_prompt(pwa_prompt) {
    $('#button-download-app').click(() => {
        pwa_prompt.prompt();
        // TODO: May want to watch for deferredPrompt.userChoice
        // promise to see what the result was and stop prompting after
        // that?

        window.history.back();
    });

    $('#page-native-prompter .firsttime-welcome-next').click(() => window.history.back());
    $.mobile.changePage('#page-native-prompter', { transition: 'none' });
}

function should_show_prompt() {
    const APP_PROMPT_KEY = 'last-app-prompt';
    let PROMPT_FREQUENCY = 25 * 24 * 60 * 60 * 1000; // prompt once a month, but only after the first few uses.
    //PROMPT_FREQUENCY = 0;     // for dev
    if (persistentStorage.getObj('uses', 0) < 5) return;

    let now = Date.now();
    let last_prompt = persistentStorage.getObj(APP_PROMPT_KEY, 0);
    if (last_prompt) {
        if (now - last_prompt < PROMPT_FREQUENCY) return;
    }

    persistentStorage.setObj(APP_PROMPT_KEY, now);
    return 1;
}

function get_app_dl_link() {
    const ua = navigator.userAgent;

    if (/IEMobile/i.test(ua))
        // IE fakes ios/android so skip that
        return;

    if (/iPhone|iPad|iPod/i.test(ua)) return { href: 'https://itunes.apple.com/us/app/worship-leader-world-language/id574971903' };
    else if (/Android/i.test(ua)) return { href: 'https://play.google.com/store/apps/details?id=com.mzealey.worship.leader' };

    // Chrome browser supporting extensions
    if (typeof window.chrome?.runtime?.sendMessage == 'function')
        return { href: 'https://chrome.google.com/webstore/detail/worship-leader/mjklaaodihaohclhbebonimanionolac', target: '_blank' };
}

// Returns 1 if it goes to a firsttime welcome page. When user clicks on the
// continue button it should resolve the firsttime_shown_deferred promise to
// move the UI on to the next stage of database initialization.
function need_to_show_firsttime_welcome_message() {
    // Just let bots go straight to what they want to see
    if (is_bot()) return;

    console.log('maybe showing firsttime welcome page');

    if (is_firsttime) {
        // Note: this doesn't work as a dialog on some devices - causes race issue...
        $.mobile.changePage('#firsttime-welcome', { transition: 'none' });
        return 1;
    }

    // Test to see if we want to prompt mobile users or PWA potential users
    // about getting the app
    if (BUILD_TYPE != 'www' || get_client_type() != 'www') return;

    let link = get_app_dl_link();
    if (!link) return;

    if (!should_show_prompt()) return;

    $('#button-download-app').attr(link);

    // For some reason when we use changePage to go to #page-native-prompter we
    // sometimes get a popstate event (no idea where it is from) which takes us
    // back to the initializing page and breaks everything. The below code
    // hacks a work-around for this by disabling listening to popstate events
    // until our dialog gets removed.
    const hash_change_state = $.mobile.hashListeningEnabled;
    if (hash_change_state) {
        $.mobile.hashListeningEnabled = false;
        firsttime_shown.then(() => ($.mobile.hashListeningEnabled = hash_change_state));
    }

    $.mobile.changePage('#page-native-prompter', { role: 'dialog', transition: 'none' });

    return 1;
}
