import { init_search_area } from './search';

let last_scroll_pos;
export function init_list() {
    const page = $('#page-list');
    page.on('pageinit', () => {
        init_search_area(page);

        page.on('click', 'ul.songlist > li > a', () => (last_scroll_pos = window.scrollY));

        // long-press on mobile devices will trigger add-to-set dialog
        page.on('contextmenu', 'ul.songlist > li > a', function (e) {
            const song_id = $(this).parent().data('song_id');

            if (song_id) {
                e.preventDefault();
                $.mobile.changePage(`#page-add-to-set?song_id=${song_id}`, { role: 'dialog', transition: 'none' });
            }
        });
    });

    page.on('pageshow', () => {
        if (last_scroll_pos != undefined) window.scrollTo(0, last_scroll_pos);
    });
}
