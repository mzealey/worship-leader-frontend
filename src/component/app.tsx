import { GlobalStyles } from '@mui/material';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createHashRouter, RouterProvider } from 'react-router';
import LANGPACK_INDEX from '../../langpack/index.json';
import { Spinner } from '../component/lock-screen';
import { DB, DB_AVAILABLE, on_dbload_failed } from '../db';
import { get_db_chosen_langs, save_db_chosen_langs } from '../db/common';
import { is_firsttime } from '../globals';
import { get_app_languages } from '../langdetect.es5';
import { useAppLang } from '../langpack';
import { PageDbLangs } from '../page/db-langs';
import { PageFirsttimeWelcome } from '../page/firsttime-welcome';
import { routes } from '../routes';
import { get_default_db_languages } from '../song-languages';
import { gup, is_bot } from '../splash-util.es5';

const LazyPageDbLoadFailed = lazy(() => import('../page/dbload-failed').then((m) => ({ default: m.PageDbLoadFailed })));

let resolveFirsttimeShown!: () => void;
const firsttime_shown = new Promise<void>((resolve) => {
    resolveFirsttimeShown = resolve;
});

enum AppState {
    Loading,
    FirsttimeScreenRequired,
    DbInitializing,
    DbInitialized,
    NeedsLanguageSelection,
    Running,
    DbLoadFailed,
}

const hide_splash = () => {
    // Remove the non-React splash screen
    if (!document.documentElement.classList.contains('show-splash')) return;

    document.documentElement.classList.remove('show-splash'); // Reveal the app

    setTimeout(() => {
        document.documentElement.classList.remove('splash-available'); // Enable scrolling etc

        // Free up some DOM
        const elem = document.getElementById('load-splash-screen');
        if (elem && elem.parentNode) elem.parentNode.removeChild(elem);
    }, 500);
};

export const App = () => {
    const [appState, setAppState] = useState<AppState>(AppState.Loading);
    const { setLanguage } = useAppLang.getState();
    const failedRef = useRef(false);

    // Track startup process and set the state of the view accordingly
    useEffect(() => {
        const dbload_failed_sub = on_dbload_failed.subscribe(() => {
            failedRef.current = true;
            setAppState(AppState.DbLoadFailed);
        });

        (async () => {
            // Legacy location handling: clean up hash and detect referral URLs.
            // This predates the React Router setup and runs before it initialises.
            window.location.hash = window.location.hash.replace(/\?.*/, '');

            if (!window.location.hash) {
                // Check to see if we came via sitemap or share with a ?song_id= normal search parameter
                const fake_search_hash = '#' + window.location.search;
                let start_song_id = gup('song_id', fake_search_hash);

                // Check to see if we came via /title-i123
                if (!start_song_id) [, start_song_id] = window.location.pathname.match(/^\/.*-i(\d+)$/) || [];

                // Probably came from a search engine referral, only use online db.
                if (start_song_id) {
                    window.location.hash = `#songinfo/${start_song_id}`; // this is pre any Router setup so should be fine
                }
            }

            // Ensure UI language pack is loaded
            const first_valid_lang = get_app_languages().find((lang) => lang in LANGPACK_INDEX);
            await setLanguage(first_valid_lang!);

            // Figure out the state we need to set. Don't show firsttime page to bots
            if (!is_bot() && is_firsttime) {
                setAppState(AppState.FirsttimeScreenRequired);
                hide_splash();
                await firsttime_shown;
            }
            console.log('firsttime shown');

            setAppState(AppState.DbInitializing);

            const db = await DB_AVAILABLE;
            if (failedRef.current) return;
            console.log('db available');
            setAppState(AppState.DbInitialized);
            if (get_db_chosen_langs().length) {
                // Run a background check to ensure the database items are up-to-date, but without blocking the UI
                db.populate_db(true);
            } else {
                // If we were called from a bot or direct from the web, then don't prompt the user for language selection;
                // rather pull a default list from the browser and set it to that, and assume that we will fall-through to
                // online db
                if (is_bot()) {
                    save_db_chosen_langs(get_default_db_languages());
                } else {
                    // Default case on first load is to show db-langs page so user can select them. Once the languages are
                    // selected, populate_db() will be called from that page and app initialization sequence will continue.
                    setAppState(AppState.NeedsLanguageSelection);
                    hide_splash();
                }
            }
            console.log('db initialized');
            await DB; // This blocks until the user has chosen DB languages and the DB is correctly populated
            if (failedRef.current) return;
            setAppState(AppState.Running);
            hide_splash();
        })();

        return () => {
            dbload_failed_sub.unsubscribe();
        };
    }, [setLanguage]);

    // Go through the various startup phases of the app showing the
    // appropriate page without modifying the hash at the correct times.
    // Once all startup is done then we can go into the router.
    if (appState == AppState.FirsttimeScreenRequired) {
        return <PageFirsttimeWelcome onComplete={() => resolveFirsttimeShown()} />;
    }

    if (appState < AppState.DbInitialized) {
        return <Spinner message_code="initializing" />;
    }

    if (appState == AppState.NeedsLanguageSelection) {
        return <PageDbLangs onClose={() => setAppState(AppState.Running)} />;
    }

    if (appState == AppState.DbLoadFailed) {
        return (
            <Suspense fallback={<Spinner />}>
                <LazyPageDbLoadFailed />
            </Suspense>
        );
    }

    if (appState != AppState.Running) {
        return <Spinner message_code="initializing" />;
    }

    return <AppRouter />;
};

function AppRouter() {
    const router = useMemo(() => createHashRouter(routes), []);

    return (
        <>
            {/* Global styles applied via MUI GlobalStyles component */}
            <GlobalStyles
                styles={(theme) => ({
                    body: {
                        // Disable blue outlines on touch
                        WebkitTapHighlightColor: 'rgba(255, 255, 255, 0)',
                        userSelect: 'none',
                        '& textarea, & input': {
                            userSelect: 'text',
                        },

                        '@media only print': {
                            color: '#000',
                            backgroundColor: '#fff',
                            textShadow: 'none',
                        },
                    },
                    ':root': {
                        '& ::-webkit-scrollbar': {
                            width: 8,
                            height: 8,
                        },
                        '& ::-webkit-scrollbar-track': {
                            borderRadius: 10,
                            backgroundColor: theme.palette.background.grey,
                        },
                        '& ::-webkit-scrollbar-thumb': {
                            borderRadius: 10,
                            backgroundColor: theme.palette.text.secondary,
                        },
                    },
                    a: {
                        color: theme.palette.text.link,
                    },
                    pre: {
                        '&:focus': {
                            outline: 'none',
                        },
                    },
                })}
            />
            <RouterProvider router={router} />
        </>
    );
}
