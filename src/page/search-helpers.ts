import { current_page } from '../jqm-util';

// Return true if the specified page (defaulting to the current page) has the
// song listing element displayed, false otherwise
function page_has_song_listing(page = current_page()) {
    if (!page)
        // perhaps at startup?
        return false;

    // On main listing page
    if (page.attr('id') == 'page-list') return true;

    // On songinfo but side-bar is shown
    if (page.children('#sidebar').css('display') == 'block') return true;

    return false;
}

export function get_song_list_page() {
    let page = $('#songinfo');
    if (!page_has_song_listing(page)) page = $('#page-list');

    return page;
}

export function force_song_list_page() {
    let page = $('#songinfo');
    if (!page_has_song_listing(page)) {
        $.mobile.changePage('#page-list');
        page = $('#page-list');
    }
    return page;
}
