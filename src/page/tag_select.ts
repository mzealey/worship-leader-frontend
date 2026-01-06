import { DB } from '../db';
import { app_lang } from '../langpack';
import { get_meta_db } from '../meta-db';
import { LOCALE_SORT } from '../sort-helpers';
import { jqm_setup } from '../startup-promises';
import { filter_tags, refresh_tag_button_status, update_filter_tag_btn } from '../tag';

export function init_tag_select() {
    const page = $('#page-tag-select');

    page.on('click', 'li[data-role=list-divider]', function () {
        let show = $(this).hasClass('ui-icon-carat-d');
        $(this).toggleClass('ui-icon-carat-d', !show).toggleClass('ui-icon-carat-u', show);

        $(this).nextUntil('li[data-role=list-divider]').not('.ui-btn-active').toggle(!!show);
    });

    page.on('click', 'li', function () {
        let li = $(this);
        let tag_id = li.data('id');
        if (!tag_id) return;

        if (!(tag_id in filter_tags)) filter_tags[tag_id] = 1;
        else if (filter_tags[tag_id]) filter_tags[tag_id] = 0;
        else delete filter_tags[tag_id];

        format_tag_button(li, tag_id);

        li.trigger('change');

        update_filter_tag_btn();
    });

    $(document).on('pagebeforeshow', '#page-list, #songinfo', function () {
        let page = $(this);
        // If this came from the page-tag-select page or so...
        if (page.data('searcharea_inited')) page.trigger('do_new_search');
        refresh_tag_button_status();
    });

    page.on('pagebeforeshow', () => {
        let tag_list = page.find('#tag-list');
        tag_list.empty();
        Promise.all([DB.then((db) => db.get_tag_counts()), get_meta_db(), jqm_setup]).then(([tag_counts, meta_db]) => {
            let tag_groups = {};
            let has_counts = Object.keys(tag_counts).length > 0; // TODO: Remove this transition code(?)

            Object.keys(meta_db.tag_mappings).forEach((tag_id) => {
                if (has_counts && !tag_counts[tag_id]) return;

                let tag = meta_db.tag_mappings[tag_id];
                const tagGroup = tag.tag_group;
                if (!tagGroup) return;
                const groupData = meta_db.tag_groups[tagGroup];
                if (!groupData) return;
                let group_name = groupData[app_lang()];
                if (!group_name) return;
                if (!tag_groups[group_name]) tag_groups[group_name] = [];
                tag_groups[group_name].push(tag);
            });

            Object.keys(tag_groups)
                .sort(LOCALE_SORT)
                .forEach((tag_group_name) => {
                    tag_list.append($('<li class="ui-btn ui-btn-icon-right ui-icon-carat-d ui-btn-b" data-role="list-divider" />').text(tag_group_name));

                    function get_tag_name(tag_code) {
                        let detail = meta_db.tags[tag_code];
                        return detail && detail[app_lang()] ? detail[app_lang()] : tag_code;
                    }

                    tag_groups[tag_group_name]
                        .sort((a, b) => LOCALE_SORT(get_tag_name(a.tag_code), get_tag_name(b.tag_code)))
                        .forEach((tag) => {
                            let item = $('<li class="ui-btn ui-btn-icon-right">')
                                .text(get_tag_name(tag.tag_code))
                                .data('id', tag.id)
                                .toggle(tag.id in filter_tags);

                            format_tag_button(item, tag.id);

                            if (has_counts) item.append($('<span class="ui-li-count">').text(tag_counts[tag.id]));

                            tag_list.append(item);
                        });
                });

            tag_list.listview('refresh');
        });
    });
}

const POSITIVE_TAG_CLASS = 'ui-icon-check ui-btn-active';
const NEGATIVE_TAG_CLASS = 'ui-icon-delete ui-btn-active';
function format_tag_button(item, tag_id) {
    item.removeClass(POSITIVE_TAG_CLASS + ' ' + NEGATIVE_TAG_CLASS);
    if (tag_id in filter_tags) item.addClass(filter_tags[tag_id] ? POSITIVE_TAG_CLASS : NEGATIVE_TAG_CLASS);
}
