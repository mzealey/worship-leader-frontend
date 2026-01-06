import { spinner } from './spinner';

// Wrap the given promise with a lock screen and spinner
export async function lock_screen(promise, spinner_options) {
    $('html').addClass('lock-screen');

    // NOTE: Only supports jqm promises
    return spinner(
        promise.finally(() => {
            $('html').removeClass('lock-screen');
        }),
        spinner_options,
    );
}

// Lock the screen and show a percentage ticker, returning a promise
export async function lock_screen_percentage(cb) {
    const progress_tracker = (perc) => {
        const text = Math.floor(perc * 100) + '%';
        $.mobile.loading._widget.find('h1').text(text);
        $.mobile.loading('option', 'text', text);
    };
    return lock_screen(cb(progress_tracker), { textVisible: true });
}
