import './main.scss';

import { send_error_report, setup_error_catcher } from './error-catcher';
import { DEBUG } from './globals';
setup_error_catcher();

import { createRoot } from 'react-dom/client';
import { setup_abc2svg } from './abc2svg';
import { App } from './component/app';
import { ErrorBoundary } from './component/error-boundary';
import { NotificationWidget } from './component/notification';
import { ThemeApp } from './component/theme';
import { cordova_setup } from './cordova-setup';
import { init_db } from './db-init';
import { setup_feedback_sender } from './feedback-sender';
import { persistentStorage } from './persistent-storage.es5';
import { load_song_languages } from './song-languages';

function update_usage_counter() {
    const uses = persistentStorage.getObj('uses', 0);
    persistentStorage.setObj('uses', uses + 1);
}

let _main_setup_done = false;

function main_setup() {
    if (_main_setup_done) return;
    _main_setup_done = true;

    // Pre-React initialization: these services must be set up before the React tree
    // mounts. Consider moving stateful services (lang detection, abc2svg) into React
    // context or Zustand stores where possible.
    const setup_fns: (() => void)[] = [
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

    elem.innerHTML = '';

    let root = (elem as Element & { _reactRoot?: ReturnType<typeof createRoot> })._reactRoot;
    if (!root) {
        root = createRoot(elem);
        (elem as Element & { _reactRoot?: ReturnType<typeof createRoot> })._reactRoot = root;
    }

    root.render(
        <ThemeApp>
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
            <NotificationWidget />
        </ThemeApp>,
    );

    update_usage_counter();
}

//window.fetch = undefined;     // for testing XHR fallbacks
main_setup();
