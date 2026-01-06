import { spinner } from '../component/spinner';
import { DB } from '../db';
import { listview_refresh } from '../jqm-util';
import { get_translation } from '../langpack';
import { on_set_db_update, SET_DB } from '../set-db';
import { setup_list_link } from '../songlist';
import { gup } from '../splash-util.es5';
import { set_title } from '../title';

export function init_set_view() {
    const page = $('#page-set-view');
    page.on('pageinit', () => {
        const set_list = page.find('.setsongs');

        page.on('click', 'a.ui-icon-delete', function () {
            SET_DB.delete_song_from_set($(this).parents('li').data('song_id'), gup('set_id'));
            $(this).parents('li').remove();
        });

        // Set up drag/drop list to order a set
        set_list.sortable({
            distance: 0,
            axis: 'y',
            handle: '.sort-handle',
        });
        set_list.disableSelection();
        set_list.bind('sortstop', () => set_list.listview('refresh'));

        set_list.bind('sortupdate', () => {
            SET_DB.update_set_db_order(
                set_list.data('set_id'),
                set_list
                    .find('li')
                    .map((i, e) => $(e).data('song_id'))
                    .get(),
            );
        });
    });

    page.on('pagebeforeshow', () => spinner(update_set_view(gup('set_id'))));

    on_set_db_update.subscribe(() => {
        if (page.is('.ui-page-active')) update_set_view(gup('set_id'));
    });
}

function _update_set_view(set_id) {
    let songs = SET_DB.get_songs(set_id);
    let order = {};
    songs.forEach((s, idx) => {
        order[s.song_id] = idx;
    });

    // Load song details for the set and then sort them according to the requested order
    return DB.then((db) =>
        db.get_songs(
            songs.map((s) => s.song_id),
            true,
            true,
        ),
    ).then((songs) => songs.sort((a, b) => order[a.id] - order[b.id]));
}

function update_set_view(set_id) {
    const page = $('#page-set-view');
    const set_list = page.find('.setsongs');

    set_list.empty();

    page.find('#share-set-btn').attr('href', `#dialog-set-share?set_id=${set_id}`);

    return Promise.all([_update_set_view(set_id), SET_DB.get_set(set_id)]).then(([songs, set]) => {
        let title = get_translation(set.live ? 'set_title_live' : 'set_title') + ': ' + set.name;
        page.find('.set-name').text(title);
        set_title(title);

        page.toggleClass('set-ro', !!set.ro).toggleClass('set-live', !!set.live);

        set_list.empty().data('set_id', set_id);

        songs.forEach((song) => setup_list_link(set_list, song));

        if (!set.ro)
            set_list.find('li').addClass('two-buttons').append(
                // Handle deletes. TODO: Replace the english (or just remove the hint?)
                $('<a class="ui-btn ui-btn-icon-notext ui-icon-delete ui-btn-a" href="#" title="Delete"></a>'),
                // Sorting handle
                '<a class="ui-btn ui-btn-icon-notext ui-icon-arrow-updown ui-btn-a sort-handle second-btn" href="#" title="Sort"></a>',
            );

        listview_refresh(set_list);
    });
}
