import { get_page_args } from '../jqm-util';
import { SET_DB } from '../set-db';

export function init_dialog_set_rename() {
    const page = $('#dialog-set-rename');
    const rename_elem = page.find('#set-name-rename') as JQuery<HTMLInputElement>;
    let set_id; // current set_id being displayed

    function update_form_submit() {
        const button = page.find('form button').get(0) as HTMLButtonElement | undefined;
        if (button) button.disabled = (rename_elem.val() as string).length == 0;
    }
    page.on('pageinit', () => {
        rename_elem.on('keyup change', update_form_submit);
        page.find('[name=set-rename]').submit((e) => {
            e.preventDefault();
            SET_DB.rename_set(set_id, rename_elem.val() as string).finally(() => page.dialog('close'));
        });
    });
    page.on('pageshow', () => {
        set_id = get_page_args(page).set_id;
        if (!set_id) page.dialog('close');

        rename_elem.val('').focus();
        update_form_submit();
        SET_DB.get_set_title(set_id).then((title) => {
            rename_elem.val(title);
            update_form_submit();
        });
    });
}
