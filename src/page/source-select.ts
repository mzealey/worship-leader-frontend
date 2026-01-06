import { DB } from '../db';
import { filter_sources, toggle_filter_source } from '../filter-sources';
import { lang_name, sorted_language_codes } from '../langpack';
import { LOCALE_SORT, SORT_TITLE_SORT } from '../sort-helpers';
import { jqm_setup } from '../startup-promises';

function format_source_button(item, source_id) {
    item.toggleClass('ui-icon-check ui-btn-active', !!filter_sources[source_id]);
}

export function init_source_select() {
    const page = $('#page-source-select');

    page.on('click', 'li[data-role=list-divider]', function () {
        let show = $(this).hasClass('ui-icon-carat-d');
        $(this).toggleClass('ui-icon-carat-d', !show).toggleClass('ui-icon-carat-u', show);

        $(this).nextUntil('li[data-role=list-divider]').not('.ui-btn-active').toggle(!!show);
    });

    page.on('click', 'li', function () {
        let li = $(this);
        let source_id = li.data('id');
        if (!source_id) return;

        toggle_filter_source(source_id);
        format_source_button(li, source_id);
        li.trigger('change');
    });

    // Refresh the list every page load - perhaps too much but easier than
    // trying to be lazy about it.
    page.on('pagebeforeshow', () => {
        const source_list = page.find('#source-list');
        source_list.empty();

        Promise.all([DB.then((db) => db.get_song_sources()), jqm_setup]).then(([sources]) => {
            let source_langs = {};
            sources.forEach((source) => {
                if (!source_langs[source.lang]) source_langs[source.lang] = [];
                source_langs[source.lang].push(source);
            });

            sorted_language_codes(Object.keys(source_langs)).forEach((lang) => {
                let sources = source_langs[lang];
                sources.sort((a, b) => SORT_TITLE_SORT(a, b) || LOCALE_SORT(a.name, b.name));

                source_list.append($('<li class="ui-btn ui-btn-icon-right ui-icon-carat-d ui-btn-b" data-role="list-divider">').text(lang_name(lang)));

                sources.forEach((source) => {
                    let item = $('<li class="ui-btn ui-btn-icon-right">')
                        .text(source.name)
                        .data('id', source.id)
                        .toggle(source.id in filter_sources);

                    format_source_button(item, source.id);
                    source_list.append(item);
                });
            });

            source_list.listview('refresh');
        });
    });
}
