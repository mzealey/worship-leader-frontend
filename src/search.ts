import { update_setting } from './settings';

import { DB, DB_AVAILABLE } from './db';
import { DBSearch, current_search } from './db-search';
import { current_page, processHash } from './jqm-util';
import { force_song_list_page } from './page/search-helpers';
import { create_goto_set } from './set';

let search_timer;

// Check to see if any of the search values changed and if so run the search
export function do_new_search(page, force = false) {
    clearTimeout(search_timer); // stop any in-progress debouncing

    DB.then((db) => {
        // Be lazy about getting/comparing the data, only do it after we can
        // execute the query straight away.
        let cur_search = current_search(page);
        if (!force && cur_search && cur_search.isEqual(db, page)) return;

        let query = new DBSearch(db, page);
        query.run();
    });
}

// Debounce events
export function run_search_timer(elem) {
    clearTimeout(search_timer);

    // Check for some clever keyword type things that we handle internally and if so abort the search
    if (elem.hasClass('search')) {
        let input = elem.val() || '';
        if (/^nocopyright$/i.test(input)) {
            update_setting('observe-copyright', 'false');
            elem.val('');
        } else if (DEBUG && /^forcecopyright$/i.test(input)) {
            update_setting('observe-copyright', 'true');
            elem.val('');
        } else if (/\bsong_id=\d+/i.test(input)) {
            // someone pasted a url of a single song
            let [, song_id] = input.match(/song_id=(\d+)/i) || [];
            elem.val(`i${song_id}`);
        } else if (/^\s*http.*#page-set-list.*/i.test(input)) {
            // Someone pasted set url in to the search box...
            let details;
            try {
                details = processHash(input.replace(/^\s+|\s+$/g, ''));
            } catch (e) {
                console.log('parsing input hash failed', e);
            }

            if (
                details &&
                details.cleanHash == '#page-set-list' &&
                details.queryParameters &&
                ((details.queryParameters.new_set && details.queryParameters.song_ids) || details.queryParameters.set_uuid)
            ) {
                create_goto_set(details.queryParameters);
                elem.val('');
            }
        }
    }

    let page = elem.parents('.ui-page').last(); // main page that it is on
    if (elem.val() == '')
        // probably triggered from clicking the x button - search straight away
        do_new_search(page);
    else {
        let search_timeout = 0;
        DB_AVAILABLE.then((db) => (search_timeout = db.ideal_debounce()));
        if (search_timeout < 250) search_timeout = 250;
        else if (search_timeout > 1000) search_timeout = 1000;

        search_timer = setTimeout(function () {
            // Explicitly check that we are still on the page that the input was
            // triggered from - it may have changed during debounce interval.
            // NOTE that some like the search sidebar have 2 pages effectively
            // so a page == current_page() comparison would not work
            if (elem.parents(current_page()).length) do_new_search(page);
        }, search_timeout);
    }
}

// Set the search text, run the search straight away, and switch the site to song listing page if required
export function set_search_text(question: string) {
    let page = force_song_list_page();

    page.find('.search').val(question).trigger('change');
    do_new_search(page);
}
