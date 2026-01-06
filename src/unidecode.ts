/**
 * Unidecode takes UTF-8 data and tries to represent it in US-ASCII characters (i.e., the universally displayable characters between 0x00 and 0x7F).
 * The representation is almost always an attempt at transliteration -- i.e., conveying, in Roman letters, the pronunciation expressed by the text in
 * some other writing system.
 *
 * The tables used (in data) are converted from the tables provided in the perl library Text::Unidecode (http://search.cpan.org/dist/Text-Unidecode/lib/Text/Unidecode.pm)
 * and are distributed under the perl license
 *
 * @author Francois-Guillaume Ribreau
 *
 * Based on the port of unidecode for php
 */

import { fetch_json } from './util';

// Output by util/generate_unidecode_data.pl; tables where there are no files or codepoints
const blanks = [25, 26, 27, 28, 29, 34, 35, 36, 38, 39, 252];

const tr: Record<number, string[]> = {};
const waiting: Record<number, Promise<void>> = {}; // List of XHR in-progress to load the tables
// eslint-disable-next-line no-control-regex
const utf8_rx = /(?![\x00-\x7F]|[\xC0-\xDF][\x80-\xBF]|[\xE0-\xEF][\x80-\xBF]{2}|[\xF0-\xF7][\x80-\xBF]{3})./g;

// returns a promise which returns the unidecoded string
export async function unidecode(str: string): Promise<string> {
    if (!str) str = '';

    // Not supported in eg older Android, but most input would be assumed NFC anyway
    if (str.normalize) str = str.normalize('NFC');

    // First ensure that all required code-tables are loaded
    const promises: Promise<void>[] = [];
    const chars = str.match(utf8_rx);
    if (chars) {
        chars.forEach(function (match) {
            const promise = unidecode_ensure_loaded(match);
            if (promise) promises.push(promise);
        });
    }

    await Promise.all(promises);
    return str.replace(utf8_rx, unidecode_internal_replace);
}

function unidecode_ensure_loaded(match: string): Promise<void> | undefined {
    const utf16 = utf8_to_utf16(match);
    const h = utf16 >> 8;

    if (!tr[h]) {
        if (blanks.indexOf(h) >= 0) {
            tr[h] = [];
            for (let i = 0; i < 255; i++) tr[h].push('');

            return;
        }

        if (!waiting[h]) {
            waiting[h] = fetch_json<string[]>('unidecode/data/x' + dec2hex(h) + '.json').then(
                (data: string[]) => {
                    tr[h] = data;
                    delete waiting[h];
                },
                (err) => {
                    // produce a blank table to avoid errors in future
                    tr[h] = [];
                    for (let i = 0; i < 255; i++) tr[h].push('');
                    console.error('error loading unidecode table', err);
                    return Promise.resolve(); // don't interrupt the other searches we are racing
                },
            );
        }
        return waiting[h];
    }

    return;
}

function unidecode_internal_replace(match: string) {
    const utf16 = utf8_to_utf16(match);

    if (utf16 > 0xffff) {
        return '_';
    } else {
        const h = utf16 >> 8;
        const l = utf16 & 0xff;

        // (18) 18 > h < 1e (30)
        if (h > 24 && h < 30) return '';

        //(d7) 215 > h < 249 (f9) no supported
        if (h > 215 && h < 249) return '';

        if (!tr[h]) throw 'Table not loaded for h:' + h + ', l:' + l;

        return tr[h][l] || '';
    }
}

function dec2hex(i: number) {
    const hex = (i + 0x100).toString(16);
    return hex.substr(hex.length - 2);
}

function utf8_to_utf16(raw: string | string[]): number {
    let value = raw;
    let b1, b2, b3, b4, x, y, z;

    while (Array.isArray(value)) value = value[0];

    switch (value.length) {
        case 1:
            return ord(value);

        // http://en.wikipedia.org/wiki/UTF-8
        case 2:
            b1 = ord(value.substring(0, 1));
            b2 = ord(value.substring(1, 2));

            x = ((b1 & 0x03) << 6) | (b2 & 0x3f);
            y = (b1 & 0x1c) >> 2;

            return (y << 8) | x;

        case 3:
            b1 = ord(value.substring(0, 1));
            b2 = ord(value.substring(1, 2));
            b3 = ord(value.substring(2, 3));

            x = ((b2 & 0x03) << 6) | (b3 & 0x3f);
            y = ((b1 & 0x0f) << 4) | ((b2 & 0x3c) >> 2);

            return (y << 8) | x;

        default:
            b1 = ord(value.substring(0, 1));
            b2 = ord(value.substring(1, 2));
            b3 = ord(value.substring(2, 3));
            b4 = ord(value.substring(3, 4));

            x = ((b3 & 0x03) << 6) | (b4 & 0x3f);
            y = ((b2 & 0x0f) << 4) | ((b3 & 0x3c) >> 2);
            z = ((b1 & 0x07) << 5) | ((b2 & 0x30) >> 4);

            return (z << 16) | (y << 8) | x;
    }
}

/* From php.js */

function ord(string: string) {
    // Returns the codepoint value of a character
    //
    // version: 1109.2015
    // discuss at: http://phpjs.org/functions/ord
    // +   original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +   bugfixed by: Onno Marsman
    // +   improved by: Brett Zamir (http://brett-zamir.me)
    // +   input by: incidence
    // *     example 1: ord('K');
    // *     returns 1: 75
    // *     example 2: ord('\uD800\uDC00'); // surrogate pair to create a single Unicode character
    // *     returns 2: 65536
    const str = string + '',
        code = str.charCodeAt(0);
    if (0xd800 <= code && code <= 0xdbff) {
        // High surrogate (could change last hex to 0xDB7F to treat high private surrogates as single characters)
        const hi = code;
        if (str.length === 1) {
            return code; // This is just a high surrogate with no following low surrogate, so we return its value;
            // we could also throw an error as it is not a complete character, but someone may want to know
        }
        const low = str.charCodeAt(1);
        return (hi - 0xd800) * 0x400 + (low - 0xdc00) + 0x10000;
    }
    if (0xdc00 <= code && code <= 0xdfff) {
        // Low surrogate
        return code; // This is just a low surrogate with no preceding high surrogate, so we return its value;
        // we could also throw an error as it is not a complete character, but someone may want to know
    }
    return code;
}
