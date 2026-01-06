/* eslint-disable @typescript-eslint/no-unused-expressions */
import { get_page_args } from './jqm-util';

export function maybe_setup_ga() {
    if (BUILD_TYPE != 'www') return;

    const ym_id = 60686398;

    delete window.ga; // in case has already been polluted by something

    // TODO: Should be a better way to bind to just the local scope rather than
    // requiring window.ga
    (function (i, s, o, g, r, a?: HTMLScriptElement, m?: Element) {
        i['GoogleAnalyticsObject'] = r;
        ((i[r] =
            i[r] ||
            function () {
                (i[r].q = i[r].q || []).push(arguments);
            }),
            (i[r].l = 1 * +new Date()));
        ((a = s.createElement(o) as HTMLScriptElement), (m = s.getElementsByTagName(o)[0]));
        a.async = true;
        a.src = g;
        m!.parentNode!.insertBefore(a, m!);
    })(window, document, 'script', 'https://www.google-analytics.com/analytics.js', 'ga');

    // Yandex
    (function (m, e, t, r, i, k?: HTMLScriptElement, a?: Element) {
        m[i] =
            m[i] ||
            function () {
                (m[i].a = m[i].a || []).push(arguments);
            };
        m[i].l = 1 * +new Date();
        ((k = e.createElement(t) as HTMLScriptElement), (a = e.getElementsByTagName(t)[0]), (k.async = true), (k.src = r), a!.parentNode!.insertBefore(k, a!));
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');
    if (window.ym)
        window.ym(ym_id, 'init', {
            trackHash: true,
            trackLinks: true,
            /*
            clickmap:true,
            accurateTrackBounce:true,
            webvisor:true
            */
        });

    if (window.ga) window.ga('create', 'UA-104898800-1', 'auto');

    $(window).bind('pagechange', (event, options) => {
        let page = options.toPage[0].id;
        let args = get_page_args(options.toPage);

        if (page == 'songinfo' && args.song_id) page += '/' + args.song_id;

        if (DEBUG) {
            console.log('sending ga for', page);
        } else {
            if (window.ga) {
                window.ga('set', 'page', '/' + page);
                window.ga('send', 'pageview');
            }
            if (window.ym) {
                window.ym(ym_id, 'hit', '/' + page);
            }
        }
    });
}
