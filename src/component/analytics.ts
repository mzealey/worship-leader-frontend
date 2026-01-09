import { PropsWithChildren, ReactNode, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

type TrackerProps = PropsWithChildren<unknown>;
type GaArgs = unknown[];

let _GATracker: (props: TrackerProps) => ReactNode;
if (BUILD_TYPE == 'www') {
    delete window.ga; // in case has already been polluted by something

    _GATracker = function __GATracker({ children }: TrackerProps) {
        const location = useLocation();
        const gaRef = useRef<((...args: GaArgs) => void) | null>(() => {});
        const lastLocationRef = useRef<string | null>(null);

        const sendLocation = (path: string) => {
            lastLocationRef.current = path;

            if (DEBUG) {
                console.log('sending ga for', path);
            } else {
                gaRef.current?.('set', 'page', path);
                gaRef.current?.('send', 'pageview');
            }
        };

        const loadGA = () => {
            // TODO: Should be a better way to bind to just the local scope rather than
            // requiring window.ga
            (function (i: unknown, s: unknown, o: unknown, g: unknown, r: unknown, a?: unknown, m?: unknown) {
                const win = i as Window & { GoogleAnalyticsObject: unknown; [key: string]: unknown };
                const doc = s as Document;
                const scriptStr = o as string;
                const gaStr = r as string;
                win['GoogleAnalyticsObject'] = gaStr;
                // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                ((win[gaStr] =
                    win[gaStr] ||
                    function () {
                        ((win[gaStr] as any).q = (win[gaStr] as any).q || []).push(arguments);
                    }),
                    ((win[gaStr] as any).l = 1 * (new Date() as unknown as number)));
                // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                ((a = doc.createElement(scriptStr)), (m = doc.getElementsByTagName(scriptStr)[0]));
                const scriptElem = a as HTMLScriptElement;
                scriptElem.async = true;
                scriptElem.src = g as string;
                (m as HTMLElement).parentNode!.insertBefore(scriptElem, m as HTMLElement);
            })(window, document, 'script', 'https://www.google-analytics.com/analytics.js', 'ga');

            gaRef.current = window.ga;
            gaRef.current?.('create', 'UA-104898800-1', 'auto');
            sendLocation(location.pathname);
        };

        useEffect(() => {
            const timer = window.setTimeout(loadGA, 2000); // Load after the page started up
            return () => window.clearTimeout(timer);
        }, []);

        useEffect(() => {
            if (lastLocationRef.current !== location.pathname) {
                sendLocation(location.pathname);
            }
        }, [location]);

        return children ?? null;
    };
} else _GATracker = ({ children }: TrackerProps) => children ?? null;

export const GATracker = _GATracker;
