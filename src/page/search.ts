import debounce from 'lodash/debounce';
import { spinner } from '../component/spinner';
import { current_search } from '../db-search';
import { get_db_chosen_langs } from '../db/common';
import { current_page, refresh_selectmenu } from '../jqm-util';
import { lang_name, sorted_language_codes } from '../langpack';
import { do_new_search, run_search_timer } from '../search';
import { get_setting, update_setting } from '../settings';
import { clear_filter_tags, update_filter_tag_btn } from '../tag';

export function update_filter_language_highlighting(elem) {
    // race conditions means can't just use ui-btn-active here
    $(elem)
        .parents('.ui-btn')
        .toggleClass('ui-btn-active-forced', $(elem).val() != 'all');
}

export function init_search() {
    $(document).one('pageshow', '#songinfo', init_songinfo_search_box);

    // Maybe refresh the listing if the database query was invalidated on another page
    $(document).on('pageshow do_new_search', '#page-list, #songinfo', (e) => do_new_search($(e.target)));

    // Update check/select boxes on change
    let body = $(document.body);
    body.on('change', 'select.order-by, select.filter-language, .filter-favourites, .filter-mp3, .filter-sheet, .filter-chord, .filter-original', function () {
        do_new_search($(this).parents('.ui-page').last());
    });

    // Update text/search inputs with a debounced timer to allow typing to finish
    body.on('keyup change paste', '.search, .songkey', function () {
        run_search_timer($(this));
    });
    body.on('blur', '.search, .songkey', function () {
        do_new_search($(this).parents('.ui-page').last());
    });

    body.on('change', `select.order-by`, function () {
        update_setting('order-by', $(this).val());
    });

    body.on('change', `select.filter-language`, function () {
        if (this.value == 'more') {
            // If 'more' is selected then show the language selection page
            $.mobile.changePage('#page-db-langs', { reverse: false });
            $(this).val(get_setting('filter-language'));
        } else {
            // Do the search etc as expected
            update_setting('filter-language', $(this).val());
            do_new_search($(this).parents('.ui-page').last());
            update_filter_language_highlighting(this);
        }
    });

    body.on('click', 'button.dropdown', function () {
        current_page().toggleClass('show-extra');
        $(this).toggleClass('ui-icon-carat-u ui-icon-carat-d');
        $(this).parents('.ui-header.ui-header-fixed').toolbar('updatePagePadding');
    });

    setup_infinite_scrolling();

    $('body').on('click', '.clear-filter-tags', function () {
        clear_filter_tags();
        update_filter_tag_btn();
        do_new_search($(this).parents('.ui-page').first());
    });
}

function setup_infinite_scrolling() {
    let cur_infinite_promise, applied_spinner;
    const generate_debouncer = (page, get_details) =>
        debounce(
            () => {
                let [scroll_top, container_height, content_height] = get_details();
                const bottom_scroll_top = content_height - container_height;

                let perc_scroll = scroll_top / bottom_scroll_top;
                if (!bottom_scroll_top && !scroll_top)
                    // not even a page full of content
                    perc_scroll = 1;

                if (cur_infinite_promise) {
                    if (!applied_spinner && perc_scroll > 0.95) applied_spinner = spinner(cur_infinite_promise);
                } else if (perc_scroll > 0.8) {
                    // Only trigger if we don't already have an in-fly infinite scroller
                    let cur_search = current_search(page);
                    if (cur_search) {
                        cur_infinite_promise = cur_search.infinite_scroll();
                        // Do after set to avoid a race when rejected straight off
                        cur_infinite_promise.finally(() => (applied_spinner = cur_infinite_promise = undefined));
                    }
                }
            },
            200, // debounce timeout (ms)
            { leading: true, trailing: true },
        );

    let sidebar_resizers: Record<string, () => void> = {};
    $('.sidebar-container').each((i, origE) => {
        const e = $(origE);
        const page = $(e).parents('[data-role=page]').last(); // not yet initialized so cannot use .ui-page
        const debouncer = generate_debouncer(page, () => [e.scrollTop(), e.height(), e[0].scrollHeight]);
        const pageId = page.attr('id');
        if (pageId) sidebar_resizers[pageId] = debouncer;
        $(e).on('scroll', debouncer);
    });
    $(window).bind('throttledresize', () => {
        let page = current_page();
        if (page) {
            const pageId = page.attr('id');
            if (pageId) {
                let resizer = sidebar_resizers[pageId];
                if (resizer) resizer();
            }
        }
    });

    const page_list = $('#page-list');
    const page_list_debounce = generate_debouncer(page_list, () => [$(document).scrollTop(), $(window).height(), $(document).height()]);
    $(document).on('scroll resize', () => {
        if (page_list.is('.ui-page-active')) page_list_debounce();
    });
}

let inited_search_areas: JQuery[] = [];
export function init_search_area(page) {
    // prevent pages from being inited twice
    if (page.data('searcharea_inited')) return;

    page.data('searcharea_inited', 1);

    // Save settings on change
    page.find('select.order-by').val(get_setting('order-by'));

    // Because it loads from db we may need to wait a little while to populate
    // the previous settings correctly
    update_language_filter_list().then(() => do_new_search(page));

    // ensure that newly created search boxes also have the same search text
    if (inited_search_areas.length) {
        let [prev_page] = inited_search_areas;

        // Require a refresh of the data first load...
        //page.data({ prev_search: prev_page.data('prev_search') });

        // Clone all the filter values from the old page
        [
            '.search',
            'select.order-by',
            '.songkey',
            'select.filter-language',
            '.filter-favourites',
            '.filter-original',
            '.filter-mp3',
            '.filter-sheet',
            '.filter-chord',
        ].forEach((selector) => {
            let element = page.find(selector);
            let prev_element = prev_page.find(selector);
            if (element.is('.tristate')) return element.tristateSetState(prev_element.data('state'));

            element.val(prev_element.val());

            if (element.is('select')) refresh_selectmenu(element);

            // Force the clear button to show when you have clicked through
            if (element.is('[type=text]')) element.textinput('option', 'clearBtn', true);
        });
    }

    inited_search_areas.push(page);
    return 1;
}

export function refresh_search_all_pages(force) {
    inited_search_areas.forEach((page) => do_new_search(page, force));
}

// Init search box on the songinfo page but only when it would be displayed (ie
// by a resize or page show function
export function init_songinfo_search_box() {
    let page = $('#songinfo');

    if (page.children('#sidebar').css('display') != 'block') return;

    if (init_search_area(page)) console.log('sidebar search box init');
}

export async function update_language_filter_list() {
    let lang_filter = $('select.filter-language');

    const loaded_langs = get_db_chosen_langs([]);

    lang_filter.find('option.auto').remove();

    sorted_language_codes(loaded_langs).forEach((lang_code) => {
        lang_filter.append(
            $('<option class="auto" />')
                .attr({
                    value: lang_code,
                    'data-localize': 'lang.' + lang_code,
                })
                .addClass('reorderable')
                .text(lang_name(lang_code)),
        );
    });
    lang_filter.val(get_setting('filter-language'));
    refresh_selectmenu(lang_filter);
    lang_filter.each((i, e) => update_filter_language_highlighting(e));
}
