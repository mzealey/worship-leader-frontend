import './main.scss';

import { send_error_report, setup_error_catcher } from './error-catcher';
setup_error_catcher();

import { createRoot } from 'react-dom/client';
import { App } from './component/app';
import { NotificationWidget } from './component/notification';
import { persistentStorage } from './persistent-storage.es5';

// Stuff that needs initing
import { setup_abc2svg } from './abc2svg';
import { ThemeApp } from './component/theme';
import { cordova_setup } from './cordova-setup';
import { init_db } from './db-init';
import { setup_feedback_sender } from './feedback-sender';
import { load_song_languages } from './song-languages';

function update_usage_counter() {
    const uses = persistentStorage.getObj('uses', 0);
    persistentStorage.setObj('uses', uses + 1);
}

function main_setup() {
    /* TODO: Move all this stuff into react as context or similar */
    let setup_fns: (() => void)[] = [
        // Key init functions
        cordova_setup,
        init_db,

        load_song_languages,

        // Set up some other services
        setup_feedback_sender,

        // Any other fns that need calling
        setup_abc2svg,
    ];

    // Catch and report any setup issues
    setup_fns.forEach((fn) => {
        try {
            fn();
        } catch (e) {
            if (DEBUG) throw e;
            send_error_report('startup', e);
        }
    });

    const elem = document.getElementById('app');
    if (!elem) throw new Error('Could not find app element');

    elem.innerHTML = ''; // kill any prepopulated stuff
    const root = createRoot(elem);

    root.render(
        <ThemeApp>
            <App />
            <NotificationWidget />
        </ThemeApp>,
    );

    update_usage_counter();
}

//window.fetch = undefined;     // for testing XHR fallbacks
main_setup();
