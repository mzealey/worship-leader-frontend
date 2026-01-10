import { get_page_args } from '../jqm-util';
import { get_translation } from '../langpack';
import { SET_DB } from '../set-db';
import { handle_share } from './sharer';

export function do_set_share(set_id, live_share) {
    return SET_DB.get_set(set_id).then((set) => {
        let params: Record<string, string> = {};

        // If sharing live then the following should be enough, but in
        // order to support legacy clients or opening without an
        // internet connection we will provide a current snapshot of
        // the share before...
        if (live_share) {
            params.set_uuid = set.uuid;
            SET_DB.mark_shared_live(set.id, 1);
        }

        // Add these afterwards as they sometimes corrupt the
        // parameters beforehand and js objects are usually serialized
        // in order that elements were created.
        params.new_set = set.name;
        params.song_ids = set.songs.map((song) => song.song_id).join(',');
        params.keys = set.songs.map((song) => song.song_key).join(',');
        params.capos = set.songs.map((song) => song.capo).join(',');

        return handle_share('#page-set-list?' + $.param(params), get_translation('share_title'), get_translation('share_set_subject'));
    });
}

export function init_dialog_set_share() {
    const page = $('#dialog-set-share');
    const _do_share = (live_share) => {
        const maybe_close_dialog = (was_native) => {
            if (was_native) window.history.back();
        };
        do_set_share(get_page_args(page).set_id, live_share).then(maybe_close_dialog, maybe_close_dialog);
    };

    page.on('pageinit', () => {
        $('#button-set-share-live').click(() => _do_share(1));
        $('#button-set-share-normal').click(() => _do_share(0));
        $('#button-set-print-songbook').click(() => {
            const set_id = get_page_args(page).set_id;
            $.mobile.changePage(`#page-print-songbook?set_id=${set_id}`);
        });
    });
}
