import { get_translation } from '../langpack';
import { on_set_db_update, SET_DB } from '../set-db';

export function init_set_list() {
    const page = $('#page-set-list');
    page.on('pagebeforeshow', update_page_set_list);

    // TODO: Debounce with setTimeout
    on_set_db_update.subscribe(() => {
        if (page.is('.ui-page-active')) update_page_set_list();
    });
}

function update_page_set_list() {
    const page = $('#page-set-list');
    const set_list = page.find('.setlist');
    generate_list_of_sets(set_list).then(
        (sets) => {
            sets.forEach((set) => {
                let li = $('<li>');
                page.find('.no-sets').hide();
                let text_entry = $(`<a href="#page-set-view?set_id=${set.id}">`).text(set.name).append(`<span class="ui-li-count">${set.total}</span>`);

                if (set.shared_live || set.live) text_entry.append(`<span class="live-shared ui-icon-rss"></span>`);

                li.append(text_entry);

                if (!set.ro)
                    li.addClass('two-buttons').append(
                        $(
                            `<a class="ui-btn ui-btn-icon-notext ui-icon-edit ui-btn-a second-btn" href="#dialog-set-rename?set_id=${set.id}" data-rel="dialog">`,
                        ).attr('title', get_translation('rename_set')),
                    );

                li.append(
                    $(`<a href="#dialog-set-delete?set_id=${set.id}" data-rel="dialog">`).text(get_translation('delete_set_btn')), // gets auto-converted to title
                );
                set_list.append(li);
            });
            set_list.listview('refresh');
        },
        () => {
            page.find('.no-sets').show();
        },
    );
}

export function generate_list_of_sets(set_list, exclude_ro = false) {
    return SET_DB.get_set_list().then((sets) => {
        set_list.empty();

        if (exclude_ro) sets = sets.filter((set) => !set.ro);

        if (!sets.length) return Promise.reject();

        return sets;
    });
}
