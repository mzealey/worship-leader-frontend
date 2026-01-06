import { current_search } from '../db-search';

export function init_pagers() {
    const _change_page = (e, direction) => {
        let cur_search = current_search($(e.target).parents('.ui-page').last());
        if (cur_search) cur_search.change_page(direction);
    };
    $(document.body).on('click', '.pager .pager-prev', (e) => _change_page(e, -1));
    $(document.body).on('click', '.pager .pager-next', (e) => _change_page(e, 1));
}
