import { GlobalStyles } from '@mui/material';
import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom';
import LANGPACK_INDEX from '../../langpack/index.json';
import { Spinner } from '../component/lock-screen';
import { DB, DB_AVAILABLE } from '../db';
import { get_db_chosen_langs, save_db_chosen_langs } from '../db/common';
import { is_firsttime } from '../globals';
import { get_app_languages, get_browser_languages } from '../langdetect.es5';
import { useAppLang } from '../langpack';
import { PageDbLangs } from '../page/db-langs';
import { PageEditTextarea } from '../page/edit';
import { PageFirsttimeWelcome } from '../page/firsttime-welcome';
import { PageList } from '../page/list';
import { PageNativePrompter } from '../page/native-prompter';
import { PageSetList } from '../page/set-list';
import { PageSetView } from '../page/set-view';
import { PageSettings } from '../page/settings';
import { PageSongInfo } from '../page/songinfo';
import { create_set_from_url, CreateSetOptions } from '../set';
import { gup, is_bot, parse_search } from '../splash-util.es5';
import { deferred_promise } from '../util';
import { GATracker } from './analytics';
import { PagesContainer } from './container';

function PageSongInfoWrapper() {
    const { song_id, set_id } = useParams();
    return <PageSongInfo requested_song_id={song_id ? parseInt(song_id) : undefined} set_id={set_id ? parseInt(set_id) : undefined} />;
}

function PageSetViewWrapper() {
    const { set_id } = useParams();
    return <PageSetView set_id={set_id ? parseInt(set_id) : 0} />;
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

const [firsttime_shown_deferred, firsttime_shown] = deferred_promise<void>(); // TODO: Kill this

enum AppState {
    Loading,
    FirsttimeScreenRequired,
    DbInitializing,
    DbInitialized,
    NeedsLanguageSelection,
    Running,
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

    // Track startup process and set the state of the view accordingly
    useEffect(() => {
        (async () => {
            // Various legacy stuff to do with location - TODO: Figure out how to react-ify this
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

            setAppState(AppState.DbInitializing);

            const db = await DB_AVAILABLE;
            setAppState(AppState.DbInitialized);
            if (get_db_chosen_langs()) {
                // Run a background check to ensure the database items are up-to-date, but without blocking the UI
                db.populate_db(true);
            } else {
                // If we were called from a bot or direct from the web, then don't prompt the user for language selection;
                // rather pull a default list from the browser and set it to that, and assume that we will fall-through to
                // online db
                if (is_bot()) {
                    save_db_chosen_langs(get_browser_languages());
                } else {
                    // Default case on first load is to show db-langs page so user can select them. Once the languages are
                    // selected, populate_db() will be called from that page and app initialization sequence will continue.
                    setAppState(AppState.NeedsLanguageSelection);
                    hide_splash();
                }
            }
            await DB; // This blocks until the user has chosen DB languages and the DB is correctly populated
            setAppState(AppState.Running);
            hide_splash();
        })();
    }, []);

    // Go through the various startup phases of the app showing the
    // appropriate page without modifying the hash at the correct times.
    // Once all startup is done then we can go into the router.
    if (appState == AppState.FirsttimeScreenRequired) {
        // TODO: Remove this _deferred and figure out proper signalling
        return <PageFirsttimeWelcome onComplete={() => firsttime_shown_deferred.resolve()} />;
    }

    if (appState < AppState.DbInitialized) {
        return <Spinner message_code="initializing" />;
    }

    if (appState == AppState.NeedsLanguageSelection) {
        return <PageDbLangs onClose={() => setAppState(AppState.Running)} />;
    }

    if (appState != AppState.Running) {
        return <Spinner message_code="initializing" />;
    }

    return (
        <>
            {/* TODO: Move this to css */}
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
                        },
                    },
                    ':root': {
                        '& ::-webkit-scrollbar': {
                            width: 8,
                            height: 8,
                        },
                        '& ::-webkit-scrollbar-track': {
                            borderRadius: 10,
                            backgroundColor: 'rgba(218, 218, 218, 0.5)',
                        },
                        '& ::-webkit-scrollbar-thumb': {
                            borderRadius: 10,
                            backgroundColor: 'rgba(61, 61, 61, 0.3)',
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
                    <PageNativePrompter />

                    <PagesContainer>
                        <Routes>
                            <Route path="/" element={<PageList />} />
                            <Route path="/page-list" element={<PageList />} />
                            <Route path="/song/:song_id" element={<PageSongInfoWrapper />} />
                            <Route path="/song/:song_id/:set_id" element={<PageSongInfoWrapper />} />

                            <Route path="/settings" element={<PageSettings />} />
                            <Route path="/set-list" element={<PageSetList />} />
                            <Route path="/set-view/:set_id" element={<PageSetViewWrapper />} />
                            <Route path="/add-song" element={<PageEditTextarea type="new" />} />

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
