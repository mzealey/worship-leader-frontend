import { clear_object } from './util';

export const filter_tags = {};

export function clear_filter_tags() {
    clear_object(filter_tags);
}

export function refresh_tag_button_status() {
    $('.tag-btn').each((_, origE) => {
        const e = $(origE);
        e.toggleClass('ui-btn-active', !!filter_tags[e.data('tag_id')]);
    });
}

export function update_filter_tag_btn() {
    $('.filter-tags').toggleClass('ui-btn-active', Object.keys(filter_tags).length != 0);
}
