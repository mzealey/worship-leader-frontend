// Very lightweight file of functions used in splash screen so we dont need to import a big dependency tree
import { load as bot_setup } from '@fingerprintjs/botd';
import { persistentStorage } from './persistent-storage.es5';

let seems_like_a_bot = false;
if (BUILD_TYPE == 'www')
    bot_setup()
        .then((botd) => botd.detect())
        .then((result) => {
            seems_like_a_bot = result.bot;
        });

export function is_bot(): boolean {
    if (BUILD_TYPE != 'www') return false;

    // Lightweight check as well as the heavier background one above
    return /bot/i.test(window.navigator.userAgent) || seems_like_a_bot;
}

export function get_setting(setting) {
    let default_settings = {
        'order-by': 'default',
        'filter-language': 'all',
        'setting-show-help': 'true',
        'setting-show-help-changed': 'false',

        // Don't show chords by default if it is a bot
        'setting-display-chords': is_bot() ? 'false' : 'true',
        'setting-show-fingering': 'true',

        'observe-copyright': BUILD_TYPE == 'www' ? 'false' : 'true',

        'setting-sidebyside': 'false',
        'setting-poweron': 'false',
        'setting-transitions': 'false', // breaks on some phones and tablets (eg tim's android, my pad)
        'setting-song-zoom': 'medium',
        'setting-chord-color': '#000000',
        'setting-hide-toolbar-btn': 'false',
        'setting-display-lyrics': 'true',
    };

    let val = persistentStorage.get(setting) || default_settings[setting];

    // If not changed then hide the help after X app uses
    if (setting == 'setting-show-help') {
        const HIDE_AFTER_USES = 5;
        if (!is_set('setting-show-help-changed')) {
            if (persistentStorage.getObj('uses', 0) > HIDE_AFTER_USES) val = 'false';
        }
    }

    return val;
}

export function is_set(setting) {
    return get_setting(setting) == 'true';
}

export const decode_uri_parameter = (param) => decodeURIComponent(param).replace(/\+/g, ' ');

export function gup(name, loc?) {
    if (loc) loc = loc.replace(/^.*?#/, '');
    else loc = window.location.hash;
    let [, query] = loc.match(/[^?]*\?(.*)/) || [];
    if (!query) return;

    let vars = query.split('&');
    let hash_args = {};
    for (let i = 0; i < vars.length; i++) {
        let [key, val] = vars[i].split('=');
        if (!key.length) continue;
        hash_args[decode_uri_parameter(key)] = decode_uri_parameter(val);
    }
    return hash_args[name];
}
