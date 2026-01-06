import { is_set } from '../settings';
import { JQueryPage } from '../song';

export function init_help() {
    // Help text
    $(document.body).on('click', '.helptext', function () {
        let e = $(this);
        e.toggleClass('full');
        if (e.hasClass('ui-footer-fixed')) e.toolbar('updatePagePadding');
    });

    // This should only exec once on a given page
    $(document).on('pagebeforecreate', (e) => {
        let p = $(e.target);

        p.find('.helptext').attr({
            'data-tap-toggle': 'false',
            'data-position': 'fixed',
            'data-theme': 'b',
            'data-role': 'footer',
        });

        update_help_toolbars(p);
    });
}

export function update_help_toolbars(page?: JQueryPage) {
    page = page || $('body');

    page.find('.helptext')
        .toggle(is_set('setting-show-help'))
        .height(is_set('setting-show-help') ? 'auto' : 0)
        .filter('.ui-footer') // only update initialized ones
        .toolbar('updatePagePadding');
}
