import { get_page_args } from '../jqm-util';
import { SET_DB } from '../set-db';

export function init_dialog_set_delete() {
    const page = $('#dialog-set-delete');
    page.on('pageinit', () => {
        $('#button-set-delete').click(() => SET_DB.delete_set(get_page_args(page).set_id));
    });
}
