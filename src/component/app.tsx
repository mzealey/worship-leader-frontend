import { GlobalStyles } from '@mui/material';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom';
import LANGPACK_INDEX from '../../langpack/index.json';
import { Spinner } from '../component/lock-screen';
import { DB, DB_AVAILABLE, on_dbload_failed } from '../db';
import { get_db_chosen_langs, save_db_chosen_langs } from '../db/common';
import { is_firsttime } from '../globals';
import { get_app_languages } from '../langdetect.es5';
import { useAppLang } from '../langpack';
import type { CreateSetOptions } from '../set';
import { create_set_from_url } from '../set';
import { get_default_db_languages } from '../song-languages';
import { gup, is_bot, parse_search } from '../splash-util.es5';
import { GATracker } from './analytics';
import { PagesContainer } from './container';

const LazyPageFirsttimeWelcome = lazy(() => import('../page/firsttime-welcome').then((m) => ({ default: m.PageFirsttimeWelcome })));
const LazyPageDbLangs = lazy(() => import('../page/db-langs').then((m) => ({ default: m.PageDbLangs })));
const LazyPageSongInfo = lazy(() => import('../page/songinfo').then((m) => ({ default: m.PageSongInfo })));
const LazyPageSetView = lazy(() => import('../page/set-view').then((m) => ({ default: m.PageSetView })));
const LazyPagePrintSongbook = lazy(() => import('../page/page-print-songbook').then((m) => ({ default: m.PagePrintSongbook })));
const LazyPageSetList = lazy(() => import('../page/set-list').then((m) => ({ default: m.PageSetList })));
const LazyPageSettings = lazy(() => import('../page/settings').then((m) => ({ default: m.PageSettings })));
const LazyPageEditTextarea = lazy(() => import('../page/edit').then((m) => ({ default: m.PageEditTextarea })));
const LazyPageEditSong = lazy(() => import('../page/edit').then((m) => ({ default: m.PageEditSong })));
const LazyPageNativePrompter = lazy(() => import('../page/native-prompter').then((m) => ({ default: m.PageNativePrompter })));
const LazyPageList = lazy(() => import('../page/list').then((m) => ({ default: m.PageList })));
const LazyPageDbLoadFailed = lazy(() => import('../page/dbload-failed').then((m) => ({ default: m.PageDbLoadFailed })));

function PageSongInfoWrapper() {
    const { song_id, set_id } = useParams();
    return (
        <Suspense fallback={<Spinner />}>
            <LazyPageSongInfo requested_song_id={song_id ? parseInt(song_id) : undefined} set_id={set_id ? parseInt(set_id) : undefined} />
        </Suspense>
    );
}

function PageSetViewWrapper() {
    const { set_id } = useParams();
    return (
        <Suspense fallback={<Spinner />}>
            <LazyPageSetView set_id={set_id ? parseInt(set_id) : 0} />
        </Suspense>
    );
}

function PagePrintSongbookWrapper() {
    const { set_id } = useParams();
    return (
        <Suspense fallback={<Spinner />}>
            <LazyPagePrintSongbook set_id={set_id ? parseInt(set_id) : 0} />
        </Suspense>
    );
}

function OldSongInfo() {
    // Parse something like #songinfo?song_id=3254&set_id=2 into /song/2354/2
    const [searchParams] = useSearchParams();
    let song_path = searchParams.get('song_id');
    if (!song_path) return <Navigate to="/" />;

    const set_id = searchParams.get('set_id');
    if (set_id) song_path += '/' + set_id;
    return <Navigate to={`/song/${song_path}`} />;
}

function OldSetList() {
    // Parse something like #page-set-list?set_uuid=30af3f92-ec6f-4166-8d2d-37cdffda3dca&new_set=foo&song_ids=568%2C2120&keys=D%2CC&capos=0%2C4
    // into a new set and return /set-view/X
    const [searchParams] = useSearchParams();
    const [redirect, setRedirect] = useState<string | null>(null);

    useEffect(() => {
        const search = '?' + searchParams.toString();
        const details = parse_search(search) as unknown as CreateSetOptions;
        if ((details.new_set && details.song_ids) || details.set_uuid) {
            create_set_from_url(details).then((set_id: number) => setRedirect(`/set-view/${set_id}`));
        }
    }, [searchParams]);

    return redirect ? <Navigate to={redirect} /> : null;
}

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
        return (
            <Suspense fallback={<Spinner />}>
                <LazyPageFirsttimeWelcome onComplete={() => resolveFirsttimeShown()} />
            </Suspense>
        );
    }

    if (appState < AppState.DbInitialized) {
        return <Spinner message_code="initializing" />;
    }

    if (appState == AppState.NeedsLanguageSelection) {
        return (
            <Suspense fallback={<Spinner />}>
                <LazyPageDbLangs onClose={() => setAppState(AppState.Running)} />
            </Suspense>
        );
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
            <HashRouter>
                <GATracker>
                    <Suspense fallback={null}>
                        <LazyPageNativePrompter />
                    </Suspense>

                    <PagesContainer>
                        <Routes>
                            <Route
                                path="/"
                                element={
                                    <Suspense fallback={<Spinner />}>
                                        <LazyPageList />
                                    </Suspense>
                                }
                            />
                            <Route
                                path="/page-list"
                                element={
                                    <Suspense fallback={<Spinner />}>
                                        <LazyPageList />
                                    </Suspense>
                                }
                            />
                            <Route path="/song/:song_id" element={<PageSongInfoWrapper />} />
                            <Route path="/song/:song_id/:set_id" element={<PageSongInfoWrapper />} />

                            <Route
                                path="/settings"
                                element={
                                    <Suspense fallback={<Spinner />}>
                                        <LazyPageSettings />
                                    </Suspense>
                                }
                            />
                            <Route
                                path="/set-list"
                                element={
                                    <Suspense fallback={<Spinner />}>
                                        <LazyPageSetList />
                                    </Suspense>
                                }
                            />
                            <Route path="/set-view/:set_id" element={<PageSetViewWrapper />} />
                            <Route path="/print-songbook/:set_id" element={<PagePrintSongbookWrapper />} />
                            <Route
                                path="/add-song"
                                element={
                                    <Suspense fallback={<Spinner />}>
                                        <LazyPageEditTextarea type="new" />
                                    </Suspense>
                                }
                            />
                            <Route
                                path="/edit-song/:song_id"
                                element={
                                    <Suspense fallback={<Spinner />}>
                                        <LazyPageEditSong />
                                    </Suspense>
                                }
                            />

                            {/* Handle legacy routes shared from jqm */}
                            <Route path="/songinfo" element={<OldSongInfo />} />
                            <Route path="/page-set-list" element={<OldSetList />} />

                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </PagesContainer>
                </GATracker>
            </HashRouter>
        </>
    );
};
