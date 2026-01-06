import { song_feedback } from '../feedback';
import { get_page_args } from '../jqm-util';
import { SET_DB } from '../set-db';
import { generate_list_of_sets } from './set-list';

function add_song_to_set(song_id, set_id) {
    if (!song_id)
        // should never happen
        return Promise.reject();

    song_feedback('set_add', song_id);
    return SET_DB.add_song_to_set(set_id, song_id, $('#chord_select').val() as string, $('#capo-select').val() as number);
}

export function init_add_to_set() {
    const page = $('#page-add-to-set');
    let song_id;

    function update_form_submit() {
        (page.find('form button').get(0) as HTMLButtonElement).disabled = (page.find('#set-name').val() as string).length == 0;
    }
    page.on('pageinit', () => {
        page.find('#set-name').on('keyup change', update_form_submit);
        page.find('[name=set-add]').submit((e) => {
            e.preventDefault();
            let elem = page.find('#set-name');
            let set_name = elem.val() as string;
            SET_DB.create_set(set_name)
                .then((new_set_id) => add_song_to_set(song_id, new_set_id))
                .finally(() => page.dialog('close'));
        });
        page.on('click', '.setlist li > a', function () {
            add_song_to_set(song_id, $(this).data('set_id')).then(
                () => page.dialog('close'), // completed
                () => page.find('#already-in-set').popup('open', { history: false, positionTo: 'window' }), // already exists
            );
        });
    });

    page.on('pageshow', () => {
        page.find('#set-name').val('').focus();
        update_form_submit();
    });
    page.on('pagebeforeshow', function () {
        song_id = get_page_args(page).song_id || $('#songinfo').data('song_id');
        if (!song_id)
            // Abort if no song_id loaded
            window.history.back();

        let set_list = page.find('.setlist');
        generate_list_of_sets(set_list, true).then((sets) => {
            sets.forEach((set) => {
                let li = $('<li>');
                li.append($('<a>').html(`${set.name} <span class="ui-li-count">${set.total}</span>`).data({ set_id: set.id }));
                set_list.append(li);
            });
            set_list.listview('refresh');
        });
    });
}
