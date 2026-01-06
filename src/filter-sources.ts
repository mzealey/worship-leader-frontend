import { current_page } from './jqm-util';
import { force_song_list_page } from './page/search-helpers';
import { persistentStorage } from './persistent-storage.es5';
import { clear_object } from './util';

export const filter_sources = {};

function update_source_search_btn() {
    $('.filter-sources').toggleClass('ui-btn-active', Object.keys(filter_sources).length != 0);
}

function save_and_search(page = current_page()) {
    persistentStorage.setObj('source-select', filter_sources);
    update_source_search_btn();
    page.trigger('do_new_search');
}

export function init_filter_sources() {
    Object.assign(filter_sources, persistentStorage.getObj('source-select', {}));
    update_source_search_btn();
    $('body').on('click', '.clear-filter-sources', () => {
        clear_filter_source();
        save_and_search();
    });
}

export function clear_filter_source() {
    clear_object(filter_sources);
}

export function toggle_filter_source(source_id, state = !(source_id in filter_sources), page = current_page()) {
    if (state) filter_sources[source_id] = 1;
    else delete filter_sources[source_id];
    save_and_search(page);
}

// Set the search text, run the search straight away, and switch the site to song listing page if required
export function set_filter_source(source_id, state = !(source_id in filter_sources)) {
    let page = force_song_list_page();

    page.find('.search').val('');
    clear_filter_source();
    toggle_filter_source(source_id, state, page);
}
