import { lock_screen_percentage } from '../component/lock-screen';
import { spinner } from '../component/spinner';
import { DB_AVAILABLE, DB_resolved } from '../db';
import { getDbLangs } from '../db-language-utils';
import { save_db_chosen_langs } from '../db/common';
import { get_page_args } from '../jqm-util';
import { get_translation, lang_name, langpack_loaded, sorted_language_codes } from '../langpack';
import { unidecode } from '../unidecode';
import { update_language_filter_list } from './search';

export function init_db_langs() {
    const page = $('#page-db-langs');

    page.on('pageshow', () => {
        // show back btn if we came from the settings page
        page.find('.ui-header').toggleClass('full-width', !get_page_args(page).from_settings);
        page.find('.ui-icon-back').toggle(!!get_page_args(page).from_settings);

        langpack_loaded().then(() => page_db_langs_try_load(page));
    });

    page.on('pageinit', () => {
        $('#button-retry-db-langs').click(() => page_db_langs_try_load(page));

        $('#button-update-db-langs').click(async () => {
            const checked_inputs = page.find('.db_langs:checked').toArray() as HTMLInputElement[];
            let languages_to_load = checked_inputs.map((e) => e.value);

            if (!languages_to_load.length) return $('#db-langs-select-one').popup('open', { history: false });

            save_db_chosen_langs(languages_to_load);

            try {
                const db = await DB_AVAILABLE;
                await lock_screen_percentage((progress_tracker) => db.populate_db(false, progress_tracker));
                await update_language_filter_list();

                if (get_page_args(page).from_settings) {
                    window.history.back();
                    // Note this is on settings page
                    setTimeout(() => $('#db-langs-update-succeeded').popup('open', { history: false }), 100);
                } else {
                    $.mobile.changePage('#page-list');
                }
            } catch (e) {
                $('#db-langs-download-error').popup('open', { history: false });
            }
        });
    });
}

function page_db_langs_try_load(page) {
    page.find('.show-on-complete, .show-on-retry').hide();
    page.find('#database-languages').empty();

    const generate_group = (items) => {
        let group = $('<fieldset data-role="controlgroup">');
        sorted_language_codes(Object.keys(items)).forEach((lang_code) => {
            group.append(...items[lang_code]);
        });
        return group;
    };

    // Combine all the promises together to generate the page with the data
    // they have fetched.
    const all_promise = getDbLangs({ alreadySetup: !!DB_resolved, lang_name }).then(
        (langs) => {
            if (!langs) return;
            const at_top: Record<string, JQuery<HTMLElement>[]> = {};
            const remaining: Record<string, JQuery<HTMLElement>[]> = {};
            // Get and set up available language selections
            for (const lang of langs) {
                const group = lang.position === 'top' || lang.selected ? at_top : remaining;
                group[lang.code] = [
                    $('<input type="checkbox" class="db_langs">')
                        .attr({ value: lang.code, id: 'db-lang-' + lang.code })
                        .prop('checked', lang.selected),
                    $('<label>')
                        .attr('for', 'db-lang-' + lang.code)
                        .text(lang_name(lang.code) + (lang.count ? ` (${lang.count})` : ''))
                        // Augment with the unicode version of the language name for filtering purposes
                        .data('filtertext', lang.unidecoded),
                ];
            }

            // We create a dummy, hidden input box to hold the unidecoded version of the search box which is what the
            // filterable plugin binds to
            const search_box_unidecoded = $('<input id="db-lang-search-unidecoded" data-role="none" style="display:none">');

            const search_box = $('<input type="search" id="db-lang-search">').attr({
                'data-placeholder-localize': 'language',
                placeholder: get_translation('language'),
            });

            const main_group = generate_group(remaining).attr({
                'data-filter': 'true',
                'data-input': '#db-lang-search-unidecoded',
            });

            page.find('#database-languages').empty().append(generate_group(at_top), search_box, search_box_unidecoded, main_group).trigger('create');

            page.find('#db-lang-search').on('keydown keyup blur change paste', (e) => {
                unidecode(e.target.value).then((str) => {
                    // Fire the text over to the filterable plugin
                    $('#db-lang-search-unidecoded').val(str.toLowerCase()).trigger('change');
                });
            });

            main_group.filterable('option', 'filterCallback', function (this: HTMLElement, index, searchValue) {
                // Custom search function to always show checked items
                if ($(this).find('input').prop('checked')) return false;

                return ($(this).find('label').data('filtertext') || '').indexOf(searchValue) === -1;
            });

            main_group.on('filterablefilter', () => page.find('.ui-footer-fixed').toolbar('updatePagePadding'));

            page.find('.show-on-complete').show();
            page.find('.ui-footer-fixed').toolbar('updatePagePadding');
        },
        function () {
            // Any errors end up here. Use the check below to see if the DB had *anything* in it.
            return DB_AVAILABLE.then((db) => db.has_any_songs()).then((has_songs) => {
                if (has_songs) {
                    // Show retry button and popup
                    page.find('.show-on-retry').show();
                    $('#db-langs-download-error').popup('open', { history: false });
                } else {
                    // If first time (ie db not initialized), then show the
                    // retry page as it's essential that we get a database
                    // loaded.
                    $.mobile.changePage('#page-dbload-failed', { reverse: false, changeHash: false });
                }
            });
        },
    );

    spinner(all_promise);
}
