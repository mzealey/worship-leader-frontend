// Very lightweight file of functions used in splash screen so we dont need to import a big dependency tree
import { load as bot_setup } from '@fingerprintjs/botd';

declare const BUILD_TYPE: string;

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

export const decode_uri_parameter = (param: string): string => decodeURIComponent(param).replace(/\+/g, ' ');

export function parse_search(loc?: string): Record<string, string> {
    const source = loc ? loc.replace(/^.*?#/, '') : window.location.hash;
    const [, query] = source.match(/[^?]*\?(.*)/) || [];
    if (!query) return {};

    const vars = query.split('&');
    const hash_args: Record<string, string> = {};
    for (let i = 0; i < vars.length; i++) {
        const [key, val = ''] = vars[i].split('=');
        if (!key.length) continue;
        hash_args[decode_uri_parameter(key)] = decode_uri_parameter(val);
    }
    return hash_args;
}
export const gup = (name: string, loc?: string): string | undefined => parse_search(loc)[name];
