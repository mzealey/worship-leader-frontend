import { decode_uri_parameter } from './splash-util.es5';

export function refresh_selectmenu(select, force = false) {
    select.each((_, e) => {
        e = $(e);
        if (e.data('mobileSelectmenu'))
            // If the selectmenu has been inited
            e.selectmenu('refresh', force); // to force jqm to update the view
    });
}

export function listview_refresh(listview) {
    try {
        listview.listview('refresh');
    } catch (e) {
        // if called before properly initialized then this will error but we
        // don't care as it will then initialize with the data that we have put
        // in
    }
}

let _current_page;
export function set_current_page(page) {
    _current_page = page;
}
export function current_page() {
    return _current_page;
}

// Helper function that splits a URL just the way we want it
export function processHash(url) {
    let parsed = $.mobile.path.parseUrl(url),
        queryParameters = {},
        hashQuery = parsed.hash.split('?');

    // Create name: value pairs from the query parameters
    $.each((hashQuery.length > 1 ? hashQuery[1] : '').split('&'), function () {
        let pair = this.split('=');

        if (pair.length > 0 && pair[0]) {
            queryParameters[pair[0]] = pair.length > 1 ? decode_uri_parameter(pair[1]) : true;
        }
    });

    return {
        parsed,
        queryParameters,
        cleanHash: hashQuery.length > 0 ? hashQuery[0] : '',
    };
}

// This is set from pagecontainerbeforechange bound in startup.js
export function get_page_args(page = _current_page) {
    return page.data('args') || {};
}
