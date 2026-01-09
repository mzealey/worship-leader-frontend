import { BUILD_TYPE } from './globals';

// Remove various characters to make searching easier
export function prepare_search_string(input: string) {
    /* See lib/Songs/Schema/Result/Songs.pm:get_search_text for full
     * explanation of this. This algo should be the same as there (but
     * including wildcard characters) as offline searches search the database
     * based on this.
     */
    input = input.replace(/[^a-zA-Z0-9@*.\s]/g, '');
    input = input.replace(/\s+/g, ' ');
    input = input.replace(/^\D{2,5}(\d+)$/i, '$1'); // replace abbreviations eg ty512 -> 512

    return input;
}

export function scroll_to(element: HTMLElement, scrollTop: number, time?: number | null) {
    if (scrollTop < 0) scrollTop = 0;

    const start_scrollTop = element.scrollTop;
    if (start_scrollTop == scrollTop) return;

    if (!time || !window.requestAnimationFrame) {
        element.scrollTop = scrollTop;
        return;
    }

    let start_time: number | undefined;
    const ease_in_out = (t: number) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1);
    const stepper = (timestamp: number) => {
        if (!start_time) start_time = timestamp;
        const perc = Math.min((timestamp - start_time) / time, 1);
        element.scrollTop = start_scrollTop + (scrollTop - start_scrollTop) * ease_in_out(perc);
        if (perc < 1) window.requestAnimationFrame(stepper);
    };
    window.requestAnimationFrame(stepper);
}

export function _ensure_visible(elem: HTMLElement, parent?: HTMLElement, animate_time = 0) {
    const parentElem = parent ?? document.documentElement;
    const parent_height = parent?.clientHeight ?? window.innerHeight;
    const parent_offset_top = parent ? parent.offsetTop : 0;

    const parent_top = parentElem.scrollTop;
    const parent_btm = parent_top + parent_height;
    const child_top = parent_top + elem.getBoundingClientRect().top - parent_offset_top;
    const child_btm = child_top + elem.clientHeight;
    if (child_top < parent_top || child_btm > parent_btm) {
        let pos = child_top - parent_height / 2 + elem.clientHeight / 2;
        scroll_to(parentElem, pos, animate_time);
    }
}

// For JQuery
export function ensure_visible(elem: JQuery, parent?: JQuery, animate_time = 0) {
    return _ensure_visible(elem[0], parent?.[0], animate_time);
}

// Promise shortcuts
// Stop-gap to make porting jquery $.Deferred() code easier to port. Difficult to kill unfortunately
export type RejectReason = unknown;
export interface DeferredPromise<T> {
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: RejectReason) => void;
}
export function deferred_promise<T>(): [DeferredPromise<T>, Promise<T>] {
    let resolve!: DeferredPromise<T>['resolve'];
    let reject!: DeferredPromise<T>['reject'];
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return [{ resolve, reject }, promise];
}

export function is_chrome_extension() {
    return !!((BUILD_TYPE == 'chrome' || BUILD_TYPE == 'edge') && window.chrome?.runtime?.id);
}
export function is_cordova() {
    return BUILD_TYPE == 'phonegap' && 'cordova' in window;
}

export function is_touch_device() {
    return (
        !!('ontouchstart' in window) || // works on most browsers
        !!('onmsgesturechange' in window)
    ); // works on ie10
}

export function is_mobile_browser() {
    // TODO: this fn is very old, basically only used to figure out if we have
    // whatsapp: and sms: support, but we mostly do this via cordova plugins
    // anyway so perhaps we can scrap this?
    let a = navigator.userAgent || navigator.vendor || window.opera;

    return (
        /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(
            a,
        ) || // eslint-disable-next-line no-useless-escape
        /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(
            a.substring(0, 4),
        )
    );
}

// Return true if str has rtl chars in it
export function is_rtl(str?: string | null) {
    // Char class matching generated by util/generate_unicode_charpoints.pl
    return /[\u0590\u05be\u05c0\u05c3\u05c6\u05c8-\u05ff\u0608\u060b\u060d\u061b-\u064a\u066d-\u066f\u0671-\u06d5\u06e5-\u06e6\u06ee-\u06ef\u06fa-\u0710\u0712-\u072f\u074b-\u07a5\u07b1-\u07ea\u07f4-\u07f5\u07fa-\u0815\u081a\u0824\u0828\u082e-\u0858\u085c-\u08e3\u200f\ufb1d\ufb1f-\ufb28\ufb2a-\ufd3d\ufd40-\ufdcf\ufdf0-\ufdfc\ufdfe-\ufdff\ufe70-\ufefe]/.test(
        str || '',
    );
}

// Return true if str has vertical (eg traditional mongolian) chars in it
export function is_vertical(str?: string | null) {
    // Also extended at \u11660-\u1167f but would need the surrogate pair matching code
    return /[\u1800-\u18af]/.test(str || '');
}

// Return true if lang is vertical
export function is_vertical_lang(lang?: string | null) {
    return lang == 'mn-TR';
}

export type FormatArg = unknown;

export function format_string(str: string, ...arg: FormatArg[]): string {
    return str.replace(/\{(\d+)\}/g, (full, number) => {
        const index = parseInt(number, 10);
        return index < arg.length ? String(arg[index]) : full;
    });
}

export type PotentialElement = unknown;
export type UnknownArgs = unknown[];
export type UnknownFunction = (...args: UnknownArgs) => unknown;

// Given a list of document fns to try, try to run and return after one has been found
export function try_to_run_fn(elem: PotentialElement, fns: string[]) {
    if (!elem) return;
    const target = elem as Record<string, unknown>;
    for (let i = 0; i < fns.length; i++) {
        const fnName = fns[i];
        const candidate = target[fnName];
        if (typeof candidate === 'function') {
            return (candidate as UnknownFunction).call(elem as unknown);
        }
    }

    return;
}

export type MediaFileAdditionalData = unknown;

export type MediaFile = {
    type?: string;
    path: string;
    download_path?: string;
    id?: number | string;
    [key: string]: MediaFileAdditionalData;
};

export function get_youtube_id(file: MediaFile) {
    if (file.type != 'video' || !/youtu/.test(file.path)) return;

    // for v=YYY or youtu.be/YYY
    let [, , youtube_id] = file.path.match(/([?&]v=|be\/)([^&]+)/) || [];
    return youtube_id;
}

export type FetchResult = unknown;

/**
 * A Promise that can optionally be aborted.
 * Used for cancellable async operations like fetch requests.
 */
export type AbortablePromise<T> = Promise<T> & {
    abort: () => void;
};

/**
 * Fetches JSON from a URL with automatic fallback to XMLHttpRequest for file:// URLs.
 * Returns an AbortablePromise that can be aborted to cancel the request.
 *
 * The abort() method will cancel the underlying fetch request using AbortController.
 * For XMLHttpRequest fallbacks, abort() will call xhr.abort().
 *
 * @example
 * const request = fetch_json<MyType>('/api/data');
 * // Later, if you need to cancel:
 * request.abort?.();
 */
export function fetch_json<T = FetchResult>(url: string, init?: RequestInit): AbortablePromise<T> {
    const FORCE_XHR = !window.fetch || url.startsWith('file:');

    // fetch() only supports http(s): protocols. On Android phonegap at least we still use file: so need to use XHR fallback
    const xhr_fallback = () => {
        const req = new window.XMLHttpRequest();
        const promise = new Promise<T>((res, rej) => {
            req.onload = () => {
                if (req.status < 200 || req.status >= 300) return rej(new Error(`HTTP ${req.status}`));
                try {
                    res(JSON.parse(req.responseText));
                } catch (e) {
                    rej(e);
                }
            };
            req.onerror = (e) => {
                console.error(`[fetch_json] XHR Error for ${url}`, e);
                rej(new Error('Network error'));
            };
            req.onabort = () => rej(new Error('Request aborted'));
            req.open('GET', url);
            req.send();
        }) as AbortablePromise<T>;

        // Add abort capability to XHR fallback
        promise.abort = () => req.abort();

        return promise;
    };

    if (FORCE_XHR) {
        return xhr_fallback();
    }

    // Create AbortController for fetch requests
    const controller = new AbortController();
    const mergedInit: RequestInit = {
        ...init,
        signal: controller.signal,
    };

    const promise = (async () => {
        try {
            const data = await window.fetch(url, mergedInit);
            return (await data.json()) as T;
        } catch (e) {
            // If fetch fails (network error, abort, etc.), try XHR fallback
            // Note: This won't retry if explicitly aborted via our controller
            if (e instanceof Error && e.name === 'AbortError') {
                throw e; // Don't retry aborted requests
            }
            return (await xhr_fallback()) as T;
        }
    })() as AbortablePromise<T>;

    // Add abort method that cancels the fetch request
    promise.abort = () => controller.abort('replaced');

    return promise;
}

export const generate_search_params = (obj: Record<string, string | number | boolean | undefined | null | string[]>) =>
    Object.keys(obj)
        .map((k) => {
            const value = obj[k];
            const rendered = Array.isArray(value) ? value.join(',') : String(value ?? '');
            return encodeURIComponent(k) + '=' + encodeURIComponent(rendered);
        })
        .join('&');

export function clear_object(obj: Record<string, unknown>) {
    Object.keys(obj).forEach((key) => delete obj[key]);
}

// From https://advancedweb.hu/how-to-add-timeout-to-a-promise-in-javascript/, wrapper a promise with a timeout rejection
export const timeout = <T>(prom: Promise<T>, time: number): Promise<T> =>
    Promise.race([prom, new Promise<T>((_r, rej) => setTimeout(() => rej(new Error('timeout')), time))]);

// Convert a Date object to UTC string representation
export const date_as_utc = (date: Date) => {
    try {
        return date.toLocaleString(undefined, { timeZone: 'UTC' });
    } catch (e) {
        return date.toString();
    }
};

// Normalize a URL by prepending the main domain if it's not already a full HTTP URL
export const normalize_url = (url: string, main_domain: string) => {
    if (!/^http/i.test(url)) {
        return main_domain + '/' + url;
    }
    return url;
};
