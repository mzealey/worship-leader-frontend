import { persistentStorage } from './persistent-storage.es5';
import { gup } from './splash-util.es5';

// Returns random integer in range 0 .. range (not inclusive)
export function random_int(range = 1) {
    let d = Date.now();
    let p = window.performance;
    if (typeof p !== 'undefined' && typeof p.now === 'function') d += p.now(); // use high-precision timer if available

    return Math.floor((Math.random() * range + d) % range);
}

// Generate a persistent random UUID for this client
let uuid = persistentStorage.get('uuid');

// TODO: Rather set this as 'user selected ui language?' saved in persistent storage?
export let is_firsttime = false;
if (!uuid) {
    // 16-byte random string persistent between sessions
    uuid = '';
    const random_chars = '01234456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    for (let i = 0; i < 16; i++) uuid += random_chars.charAt(random_int(random_chars.length));

    persistentStorage.set('uuid', uuid);
    is_firsttime = true;
}

// Patch matchMedia.addListener to trigger immediately, and handle old rubbish browsers
export function match_media_watcher(
    query: string,
    callback: (mql: MediaQueryList & { unsubscribe?: () => void }) => void,
): (MediaQueryList & { unsubscribe?: () => void }) | undefined {
    if (!window.matchMedia) return undefined; // ie9 etc

    query = query.replace(/^@media( ?)/m, ''); // allow both @media and non- prefixed
    const mql = window.matchMedia(query) as MediaQueryList & { unsubscribe?: () => void };
    callback(mql);

    if (!mql.addListener)
        // flag old browsers as not being set up properly
        return undefined;

    const listener = (_ev: MediaQueryListEvent) => callback(mql);
    mql.addListener(listener);
    mql.unsubscribe = () => mql.removeListener(listener);
    return mql;
}

export const get_uuid = () => uuid;

let CLIENT_TYPE = 'www';

if ((BUILD_TYPE == 'chrome' || BUILD_TYPE == 'edge') && window.location.protocol == 'chrome-extension:') CLIENT_TYPE = 'chr';

// ios or and
if (BUILD_TYPE == 'phonegap' && window.cordova && window.cordova.platformId) CLIENT_TYPE = window.cordova.platformId.substring(0, 3);

if (BUILD_TYPE == 'www') {
    // If it was run as a web app. For some reason the display-mode doesn't
    // seem to trigger until after DOMContentLoaded event has been fired.
    // chrome:
    match_media_watcher('(display-mode: standalone)', (e) => {
        if (e.matches) CLIENT_TYPE = 'app';
    });

    if (navigator.standalone === true)
        // safari
        CLIENT_TYPE = 'app';
}

export const get_client_type = () => CLIENT_TYPE;

// Where do we do ajax requests etc?
let MAIN_DOMAIN = 'https://songs.worshipleaderapp.com';
export const get_main_domain = () => MAIN_DOMAIN;

// For debugging on local computer
//if( DEBUG && window.location.host == 'localhost:3501' ) MAIN_DOMAIN = 'http://localhost:3500';

let HOST: string | undefined;
export const get_host = () => {
    if (!HOST) {
        // localhost:8080 is wkwebview. localhost is android cordova
        HOST = /^https?:/.test(window.location.protocol) && window.location.host != 'localhost:8080' && window.location.host != 'localhost' ? '' : MAIN_DOMAIN;

        if (DEBUG) {
            HOST = MAIN_DOMAIN;
            //HOST = 'http://localhost:3500';

            let online_db = gup('online_db');
            if (online_db && /^http/.test(online_db)) HOST = online_db;
        }
    }

    return HOST;
};

// The dump => version to download from the server
export const DUMP_VERSION = 2;

// Local testing
//export const get_db_path = () => `/static/offline/db${DUMP_VERSION}/db`;

export const get_db_path = () => `${get_host()}/db${DUMP_VERSION}/db`;
