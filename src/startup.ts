import { watch_for_spinner_available } from './component/spinner';
import { current_page, get_page_args, processHash, set_current_page } from './jqm-util';
import { init_songinfo_search_box } from './page/search';
import { load_songinfo_page } from './page/songinfo';
import { render_primary_songxml } from './render-songxml';
import { set_search_text } from './search';
import { create_goto_set } from './set.js';
import { is_set } from './settings';
import { gup } from './splash-util.es5';
import { app_inited, is_setup, jqm_setup } from './startup-promises';
import { is_mobile_browser } from './util';

let start_location;
let start_question;
let showed_initializing_page;

function setup_listeners() {
    // Close dialogs by clicking on background
    $(document.body).on('click', '[data-role=dialog]', function (event) {
        // Only track non-bubbled events
        if (event.target != event.currentTarget) return;

        $(this).dialog('close');
    });

    /* Allow an F5 refresh or back button to reload the same song as we were on
     * previously.
     */
    $(window).bind('pagechange', function (event, options) {
        let page = options.toPage;
        let opts = get_page_args(page);

        // Any pages that take custom arguments should hook in here:
        if (page.attr('id') == 'page-set-list') {
            if (!(opts.new_set && opts.song_ids) && !opts.set_uuid) return;

            // Strip the hash details off (TODO: Can we do this without it
            // appearing in the history?)
            $.mobile.changePage('#page-set-list', { allowSamePageTransition: true, translation: 'none' });

            create_goto_set(opts);
        } else if (page.attr('id') == 'songinfo') load_songinfo_page(opts);
    });

    // When the page is about to change, we may want to modify the navigation
    // process to accommodate same-page navigation. Since we wish to make it appear
    // as though we're navigating between different pages, we need to queue the
    // page update to occur right at the halfway point of the transition associated
    // with page-to-page navigation.
    $.mobile.document.on('pagecontainerbeforechange', function (event, data) {
        let page;
        /*
            When received with data.toPage set to a string, the event indicates
            that navigation is about to commence. The value stored in data.toPage
            is the URL of the page that will be loaded.

            When received with data.toPage set to a jQuery object, the event
            indicates that the destination page has been loaded and navigation will
            continue.
         */

        if (typeof data.toPage !== 'string') return;

        let d = processHash(data.toPage);
        page = $(d.cleanHash);
        //console.log('beforechange', d.cleanHash);
        if (!page.length)
            // if you re-force open / then it will be blank
            page = $('#page-list');

        page.jqmData('url', d.parsed.hash); // hack jqm internals to make the url in the toolbar get updated appropriately
        page.data('args', d.queryParameters); // store for later retrieval via get_page_args()

        // Disable transitions on startup and if they are disabled in settings
        if (!is_set('setting-transitions') || !is_setup()) data.options.transition = 'none';

        set_current_page(page);
    });

    $(document).on('pagebeforecreate', function (e) {
        // This should only exec once on a given page
        // Show widescreen-only-btn on all computers & any mobile devices with wide screens
        if (!is_mobile_browser()) $(e.target).find('.widescreen-only-btn').css({ display: 'inline-block' });
    });

    watch_for_spinner_available();

    let prev_width = window.innerWidth;

    // NOTE: not called when a print event happens
    $(window).bind('throttledresize', () => {
        // On android chrome the window resize is triggered when the header appears or disappears but we only actually care about the width changing...
        if (prev_width == window.innerWidth) return;

        render_primary_songxml();
        init_songinfo_search_box();
        prev_width = window.innerWidth;
    });
    $(document).on('pageinit', (e) => {
        // XXX this will always show initializing page because it waits above for the langpack to load.
        let page_id = $(e.target).attr('id');
        if (!is_setup() && !showed_initializing_page) {
            console.log('not setup pageinit', page_id);
            if (page_id != 'page-db-langs')
                $.mobile.changePage('#page-initializing', {
                    reverse: false,
                    transition: 'none',
                    changeHash: false,
                });
            showed_initializing_page = 1;
        }
    });
}

function setup_initial_location() {
    // User should never start on these pages - redirect to the main list page
    if (!start_location || start_location == '#/' || /firsttime-welcome|page-(initializing|dbload-failed|db-langs|sharer)/.test(start_location))
        start_location = '#page-list';

    console.log('start_location', start_location);
}

export function jqm_startup() {
    // startup page of something like http://localhost:3501/#page-settings&ui-state=dialog breaks jqm
    let loc = window.location.href;
    let loc_no_ampersand = loc.replace(/(#[^?]*)&.*?$/, '$1');
    if (loc !== loc_no_ampersand) window.location.href = loc_no_ampersand;

    setup_listeners();

    jqm_setup.then(() => {
        setTimeout(() => $('html').removeClass('show-splash'), 200);

        if (start_question) set_search_text(start_question);
    });

    app_inited.then(() => {
        console.log('app inited');

        // this needed to do the start_location load properly for some reason
        if (showed_initializing_page) setTimeout(() => change_location_from_intent(start_location), 20);
    });

    // Fake the search string as a hash so we can use gup on both hash and search strings if needed
    const fake_search_hash = '#' + window.location.search;

    set_start_location(window.location.hash);
    set_start_question(gup('q') || gup('q', fake_search_hash));

    if (!start_location) {
        // Check to see if we came via sitemap (song.html / index.html / /?song_id=...)
        let start_song_id = gup('song_id', fake_search_hash);

        // Check to see if we came via /title-i123
        if (!start_song_id) [, start_song_id] = window.location.pathname.match(/^\/.*-i(\d+)$/) || [];

        if (start_song_id) set_start_location('#songinfo?song_id=' + start_song_id);
    }

    setup_initial_location();

    // probably not needed but we want to speak to the remote server where possible
    $.mobile.allowCrossDomainPages = true;
}

export function set_start_location(loc) {
    start_location = loc;
}
export function set_start_question(q) {
    start_question = q;
    console.log('set start question', q);
}
export function change_location_from_intent(new_location) {
    if (!new_location) return;

    // If already setup then bounce to the correct page
    if (is_setup()) {
        console.log('is already setup - doing change page', new_location, current_page());
        $.mobile.changePage(new_location, {
            reverse: false,
        });
        $(window).trigger('hashchange'); // Force hashchange trigger to run
    } else {
        set_start_location(new_location);
        setup_initial_location();
    }
}
