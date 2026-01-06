let spinner_count = 0;
let _first_page_container_create;
let interval_watcher;

export function watch_for_spinner_available() {
    // loader is only created at this point so this is the first time we can set it up...
    $(window).one('pagecontainercreate', () => {
        _first_page_container_create = 1;
        maybe_show_spinner();
    });
}

function maybe_show_spinner(options: Record<string, unknown> = {}) {
    if (_first_page_container_create && spinner_count > 0 && !$('html.ui-loading').length) $.mobile.loading('show', options);
}

export function show_spinner(options: Record<string, unknown> = {}) {
    // JQM automatically hides spinner on page transition (_cssTransition) so
    // make sure that we show it periodically
    if (!interval_watcher) interval_watcher = setInterval(() => maybe_show_spinner(options), 500);

    // TODO: Give 10 sec timeout or something to ensure it always gets hidden?
    // JQM will do it automatically on page change.
    spinner_count++;

    maybe_show_spinner(options);
}

export function hide_spinner() {
    if (spinner_count > 0) spinner_count--;

    if (_first_page_container_create && spinner_count == 0) $.mobile.loading('hide');
}

// Wrap the given promise with a spinner. Note that if promise lasts < 100ms or
// so chrome often may not show the element
export function spinner<T>(promise: Promise<T>, options: Record<string, unknown> = {}): Promise<T> {
    show_spinner(options);
    return promise.finally(hide_spinner);
}
