import { persistentStorage } from './persistent-storage.es5';

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
export const BUILD_TYPE = import.meta.env.VITE_BUILD_TYPE!;
export const DEBUG = import.meta.env.VITE_DEBUG!;
export const APP_VERSION = import.meta.env.VITE_APP_VERSION!;

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

export const SHARE_DOMAIN = import.meta.env.VITE_SHARE_DOMAIN!;
export const API_HOST = import.meta.env.VITE_API_HOST!; // For main API and DB calls
export const EVENT_SOCKET_HOST = import.meta.env.VITE_API_HOST!; // for event socket (ws_server)

// The dump => version to download from the server
export const DUMP_VERSION = 2;

// Local testing
//export const DB_PATH = = `/static/offline/db${DUMP_VERSION}/db`;

export const DB_PATH = `${API_HOST}/db${DUMP_VERSION}/db`;
