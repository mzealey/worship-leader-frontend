// TODO: Set document.title
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import { ComponentType, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import type { Subscription } from 'rxjs';
import { useCanPrint } from '../can-print';
import { ImageButton } from '../component/basic';
import { useLastButtonHandler, type LastButtonHandlerComponent } from '../component/container';
import * as Icon from '../component/icons';
import { TextDirection } from '../component/song-list';
import {
    DialogPresent,
    MobileScroller,
    SetPrevNext,
    SongPageSidebar,
    SongPresentBtn,
    SongRefreshBtn,
    SongsDisplay,
    sidebar_width,
} from '../component/songinfo-other';
import { FavouriteButton, SongInfoSide } from '../component/songinfo-sidebar';
import { TopBar } from '../component/top-bar';
import { statusbar } from '../cordova-utils';
import { DB } from '../db';
import { is_offline_db } from '../db/offline-common';
import { song_feedback } from '../feedback';
import { match_media_watcher } from '../globals';
import { useAppLang, useTranslation } from '../langpack';
import { usePagePadding } from '../page-padding';
import { persistentStorage } from '../persistent-storage.es5';
import { Fragment, Link } from '../preact-helpers';
import { send_fake_resize } from '../resize-watcher';
import { on_set_db_update } from '../set-db';
import { SetSwitcher } from '../set-switcher';
import { useSetting } from '../settings-store';
import { Song } from '../song';
import { LOCALE_SORT } from '../sort-helpers';
import { TransposeDetails } from '../transpose-details';
import { is_cordova, scroll_to, try_to_run_fn } from '../util';
import { DialogAddToSet } from './add-to-set';
import { PageCopyTextarea } from './copy';
import { PageEditTextarea } from './edit';
import { PageSharer } from './sharer';

const FULL_SCREEN_EVENTS = ['webkitfullscreenchange', 'mozfullscreenchange', 'fullscreenchange', 'MSFullscreenChange'];

// External props that can be passed from outside
export interface PageSongInfoProps {
    requested_song_id?: number;
    set_id?: number;
}

export const PageSongInfo: ComponentType<PageSongInfoProps> = ({ requested_song_id, set_id }) => {
    const { t, lang_name } = useTranslation();
    const { appLang } = useAppLang();
    const theme = useTheme();
    const { set: setLastButtonHandler } = useLastButtonHandler();
    const [display_lyrics] = useSetting('display-lyrics');
    const { canPrint } = useCanPrint();
    const verticalPagePadding = usePagePadding((state) => state.bottom + state.top);

    const [hide_sidebar, setHideSidebar] = useState<boolean>(() => persistentStorage.getObj('hide-sidebar', false));
    const [related_songs, setRelatedSongs] = useState<Song[]>([]);
    const [transpose, setTranspose] = useState<TransposeDetails | undefined>(undefined);
    const [song, setSong] = useState<Song | undefined>(undefined);
    const [allow_sidebar, setAllowSidebar] = useState<boolean>(true);
    const [go_to_list_page, setGoToListPage] = useState<boolean>(false);
    const [is_printing, setIsPrinting] = useState<boolean>(false);
    const [in_presentation, setInPresentation] = useState<boolean>(false);
    const [song_loading, setSongLoading] = useState<boolean>(true);
    const [set_switcher, setSetSwitcher] = useState<SetSwitcher | undefined>(undefined);
    const [show_scroller, setShowScroller] = useState<boolean>(false);
    const [show_copy, setShowCopy] = useState<boolean>(false);
    const [show_edit, setShowEdit] = useState<'edit' | 'new' | undefined>(undefined);
    const [show_present, setShowPresent] = useState<boolean>(false);
    const [share_link, setShareLink] = useState<string | undefined>(undefined);
    const [add_to_set, setAddToSet] = useState<boolean>(false);

    type MatchMediaSubscription = (MediaQueryList & { unsubscribe?: () => void }) | undefined;

    const presentation_area_ref = useRef<HTMLDivElement | null>(null);
    const last_print_id_ref = useRef<number | null>(null);
    const print_watcher_ref = useRef<MatchMediaSubscription>(undefined);
    const set_watcher_ref = useRef<Subscription | null>(null);
    const sidebar_watcher_ref = useRef<MatchMediaSubscription>(undefined);
    const scroller_watcher_ref = useRef<MatchMediaSubscription>(undefined);
    const update_item_refs_ref = useRef<((name: string, element: HTMLElement | null) => void) | undefined>(undefined);

    const transposePayload = useMemo(() => {
        if (!transpose) return undefined;
        return {
            keyName: String(transpose.keyName ?? ''),
            capo: transpose.capo ?? 0,
        };
    }, [transpose]);

    const add_button_handler: LastButtonHandlerComponent = useMemo(
        () => ({
            icon: Icon.AddToSet,
            title: 'add_to_set',
            component: (props) => <DialogAddToSet transpose={transposePayload} song_id={song?.id ?? 0} {...props} />,
        }),
        [transposePayload, song],
    );

    const exit_button_handler: LastButtonHandlerComponent = useMemo(
        () => ({
            icon: Icon.ExitSet,
            title: 'exit_set',
            component: (props) => {
                props.onClose();
                return <Navigate replace={false} to={`/song/${requested_song_id}`} />;
            },
        }),
        [requested_song_id],
    );

    // Should we do a redirect to the list page if we are not showing the sidebar?
    const on_filter_change = useCallback(() => {
        if (!allow_sidebar) setGoToListPage(true);
    }, [allow_sidebar]);

    const onprinthandler = useCallback(() => {
        // Is probably called multiple times per print request and we don't know
        // how many sheets it output anyway so just send 1 per song id.
        if (song && song.id && last_print_id_ref.current != song.id) {
            last_print_id_ref.current = song.id;
            song_feedback('print', song.id);
        }
    }, [song]);

    const setup_track_prints = useCallback(() => {
        // Track song prints. From https://www.tjvantoll.com/2012/06/15/detecting-print-requests-with-javascript/
        print_watcher_ref.current = match_media_watcher('print', (mql: MediaQueryList) => {
            if (mql.matches)
                // before print
                onprinthandler();
        });

        if (!print_watcher_ref.current && window.onbeforeprint)
            // legacy patch
            window.onbeforeprint = onprinthandler;
    }, [onprinthandler]);

    // Trigger a print from the button on the page
    const _do_print = useCallback(() => {
        if (is_cordova() && cordova.plugins && cordova.plugins.printer) {
            // Cordova webviews doesn't support printing natively so we need to use a plugin
            cordova.plugins.printer.print('', {}, (res: boolean) => {
                if (res) onprinthandler();
            });
        } else {
            // Desktop browsers, safari (mobile) all support the standard
            // window.print. These days even android chrome seems to support it
            // well - woohoo!
            try {
                window.print(); // note this is synchronus
                onprinthandler();
            } catch (e) {
                // Rarely browsers (edge, perhaps IE with no printer drivers) do an err if print was cancelled
            }
        }
    }, [onprinthandler]);

    const do_print = useCallback(() => {
        setIsPrinting(true);
        _do_print();
        setIsPrinting(false);
    }, [_do_print]);

    const enter_single_presentor_mode = useCallback(() => {
        scroll_to(document.documentElement, 0, 500);
        setInPresentation(true);
        presentation_area_ref.current?.focus();
        if (song) {
            song_feedback('present', song.id);
        }

        // Try to get fullscreen through all browser prefixes
        try_to_run_fn(presentation_area_ref.current, [
            'requestFullscreen',
            'webkitRequestFullscreen',
            'webkitRequestFullScreen',
            'mozRequestFullScreen',
            'msRequestFullscreen',
        ]);
        statusbar('hide');
    }, [song]);

    const exit_single_presentor_mode = useCallback(() => {
        statusbar('show');

        // exit the full screen mode whatever called us (chrome 71+ throw error per https://github.com/jpilfold/ngx-image-viewer/issues/23)
        if (document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement)
            try_to_run_fn(document, ['exitFullscreen', 'webkitExitFullscreen', 'webkitCancelFullScreen', 'mozCancelFullScreen', 'msExitFullscreen']);
        setInPresentation(false);
    }, []);

    const handle_fullscreen_change = useCallback(() => {
        let fullscreenElement = document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
        if (!fullscreenElement) exit_single_presentor_mode();
    }, [exit_single_presentor_mode]);

    const presentor_key_event = useCallback(
        (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            const is_input = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.hasAttribute('contenteditable'));
            if (!is_input && !e.altKey && set_switcher && e.keyCode == 37) {
                // left
                e.preventDefault();
                window.location.hash = `#song/${set_switcher.move(-1)}/${set_switcher.set_id}`;
                presentation_area_ref.current?.focus();
            } else if (!is_input && !e.altKey && set_switcher && e.keyCode == 39) {
                // right
                e.preventDefault();
                window.location.hash = `#song/${set_switcher.move(1)}/${set_switcher.set_id}`;
                presentation_area_ref.current?.focus();
            } else if (e.keyCode == 122) {
                // F11
                if (in_presentation) exit_single_presentor_mode();
                else enter_single_presentor_mode();
                e.preventDefault();
            } else if (in_presentation && e.keyCode == 27) {
                // escape
                e.preventDefault();
                exit_single_presentor_mode();
            }
        },
        [set_switcher, in_presentation, exit_single_presentor_mode, enter_single_presentor_mode],
    );

    const update_set_switcher = useCallback(
        (newSong: Song | undefined = song) => {
            if (set_id !== undefined && newSong) setSetSwitcher(new SetSwitcher(set_id, newSong.id));
            else setSetSwitcher(undefined);
        },
        [song, set_id],
    );

    const new_song = useCallback(
        (newSong?: Song | null) => {
            console.log('new_song', newSong);
            setTranspose(undefined);
            setRelatedSongs([]);
            update_set_switcher(newSong ?? undefined);

            if (newSong) setTranspose(new TransposeDetails(newSong, set_id));
        },
        [set_id, update_set_switcher],
    );

    const load_song = useCallback(
        async (song_id: number) => {
            console.log('loading song', song_id);
            setSongLoading(true);
            try {
                const db = await DB;
                const song = await db.get_song(song_id, true);
                song_feedback('view', song_id);
                if (in_presentation) song_feedback('present', song_id);
                if (song) setSong(song);
                else setSong(undefined);

                scroll_to(document.documentElement, 0, 500);
                if (presentation_area_ref.current) scroll_to(presentation_area_ref.current, 0, 500); // for presentation mode

                const songs: (Song & { _lang_txt?: string })[] = await db.get_songs(song!.related_songs.map((s) => s.id));

                // Sort according to language names but with original at the top
                songs.forEach((res) => (res._lang_txt = lang_name(res.lang)));
                songs.sort((a, b) => (b.is_original || 0) - (a.is_original || 0) || LOCALE_SORT(a._lang_txt!, b._lang_txt!));

                setRelatedSongs(songs);
            } finally {
                setSongLoading(false);
            }
        },
        [in_presentation],
    );

    const refresh_song = useCallback(async () => {
        if (requested_song_id) {
            DB.then((db) => {
                if (is_offline_db(db)) return db.refresh_song_from_db(requested_song_id);
            }).then(() => load_song(requested_song_id));
        }
    }, [requested_song_id, load_song]);

    const toggle_sidebar = useCallback(() => {
        const new_hide_sidebar = !hide_sidebar;
        setHideSidebar(new_hide_sidebar);
        persistentStorage.setObj('hide-sidebar', new_hide_sidebar);

        // Toggle a SongXML/SheetMusic component refresh, probably by sending a fake resize event
        send_fake_resize();
    }, [hide_sidebar]);

    useEffect(() => {
        setup_track_prints();

        setLastButtonHandler(set_id ? exit_button_handler : add_button_handler);

        // Set up a media query watcher that kills sidebar DOM whenever window gets smaller than the breakpoint that it gets hidden
        sidebar_watcher_ref.current = match_media_watcher(theme.breakpoints.down('sm'), (e) => setAllowSidebar(!e.matches));
        scroller_watcher_ref.current = match_media_watcher(theme.breakpoints.down('sm'), (e) => setShowScroller(e.matches));

        // Escape is not passed in chrome at least when exiting full screen mode so we need to catch it here
        FULL_SCREEN_EVENTS.map((e) => document.addEventListener(e, handle_fullscreen_change));
        document.body.addEventListener('keydown', presentor_key_event);

        if (requested_song_id) load_song(requested_song_id);

        set_watcher_ref.current = on_set_db_update.subscribe(() => {
            // TODO: is there some way of identifying if there was a change to the one we are displaying?
            update_set_switcher();
        });

        return () => {
            setLastButtonHandler(undefined);
            set_watcher_ref.current?.unsubscribe();
            set_watcher_ref.current = null;
            document.body.removeEventListener('keydown', presentor_key_event);
            FULL_SCREEN_EVENTS.forEach((eventName) => document.removeEventListener(eventName, handle_fullscreen_change));
            print_watcher_ref.current?.unsubscribe?.();
            sidebar_watcher_ref.current?.unsubscribe?.();
            scroller_watcher_ref.current?.unsubscribe?.();
            print_watcher_ref.current = undefined;
            sidebar_watcher_ref.current = undefined;
            scroller_watcher_ref.current = undefined;
        };
    }, []);

    useEffect(() => {
        // Check if us being-in-a-set changed
        setLastButtonHandler(set_id ? exit_button_handler : add_button_handler);
    }, [set_id, exit_button_handler, add_button_handler]);

    useEffect(() => {
        new_song(song);
    }, [set_id, new_song, song]);

    useEffect(() => {
        if (requested_song_id) {
            load_song(requested_song_id);
        }
    }, [requested_song_id, load_song]);

    const set_presentation_area = (e: HTMLDivElement | null) => {
        presentation_area_ref.current = e;
    };
    const show_add_to_set = () => setAddToSet(true);
    const do_show_copy = () => setShowCopy(true);
    const do_show_edit = () => setShowEdit('edit');
    const show_new = () => setShowEdit('new');
    const do_show_present = () => setShowPresent(true);
    const show_share = () => {
        if (song) setShareLink(`song.html?song_id=${song.id}`);
    };

    const dummy = () => {};

    if (go_to_list_page) return <Navigate to="/" />;

    let title;
    if (!song_loading) {
        if (song) title = song.title;
        else if (requested_song_id)
            // not found - perhaps was removed from the db but more likely user
            // is offline and using offlinedb that doesn't have this language
            // in it
            title = t('unknown-song') + ` (i${requested_song_id})`;
    }

    const show_sidebar = !hide_sidebar && allow_sidebar;
    let song_display;
    if (song)
        song_display = (
            <SongInfoSide
                related_songs={related_songs}
                song={song}
                /*refresh_song={refresh_song} TODO */
                on_filter_change={on_filter_change}
                update_item_refs={update_item_refs_ref.current || dummy}
            />
        );

    if (display_lyrics)
        song_display = (
            <SongsDisplay
                song={song}
                in_presentation={in_presentation}
                related_songs={related_songs}
                song_loading={song_loading}
                transpose={transpose}
                is_printing={is_printing}
                set_switcher={set_switcher}
                set_id={set_id}
                update_item_refs={update_item_refs_ref.current || dummy}
                exit_single_presentor_mode={exit_single_presentor_mode}
                set_presentation_area={set_presentation_area}
            >
                {song_display}
            </SongsDisplay>
        );

    return (
        <Fragment>
            {show_sidebar && song && <SongPageSidebar active_song_id={song.id} />}

            <Box
                minHeight={`calc(100vh - ${verticalPagePadding}px)`}
                display="flex"
                flexDirection="column"
                sx={{
                    ...(show_sidebar && {
                        '@media only screen': {
                            marginLeft: `${sidebar_width + 1}px`,
                        },
                    }),
                }}
            >
                <Box display="none" displayPrint="block">
                    <Typography variant="h4" align="center">
                        <TextDirection lang={song ? song.lang : appLang}>{title}</TextDirection>
                    </Typography>
                    {song && song.alternative_titles && song.alternative_titles.length > 0 && (
                        <Typography variant="h6" align="center">
                            <TextDirection lang={song.lang}>{song.alternative_titles.join(', ')}</TextDirection>
                        </Typography>
                    )}
                </Box>

                <TopBar
                    sx={{
                        ...(show_sidebar && {
                            left: `${sidebar_width}px`,
                            width: 'auto',
                        }),
                    }}
                    before={
                        allow_sidebar ? (
                            <IconButton onClick={toggle_sidebar} title={t(hide_sidebar ? 'sidebar_show' : 'sidebar_hide')} color="primary">
                                {hide_sidebar ? <Icon.ListShow /> : <Icon.ListHide />}
                            </IconButton>
                        ) : (
                            <IconButton color="primary" title={t('back')} component={Link} to="/">
                                <Icon.Back />
                            </IconButton>
                        )
                    }
                    title={<TextDirection lang={song ? song.lang : appLang}>{title}</TextDirection>}
                    menuOnly={
                        <Fragment>
                            {display_lyrics && canPrint && (
                                <ImageButton icon={Icon.Print} onClick={do_print}>
                                    {t('print-btn')}
                                </ImageButton>
                            )}

                            {display_lyrics && (
                                <ImageButton icon={Icon.Copy} onClick={do_show_copy}>
                                    {t('copybtn')}
                                </ImageButton>
                            )}

                            {display_lyrics && (
                                <ImageButton icon={Icon.EditSong} onClick={do_show_edit}>
                                    {t('editbtn')}
                                </ImageButton>
                            )}
                            {display_lyrics && (
                                <ImageButton icon={Icon.NewSong} onClick={show_new}>
                                    {t('newbtn')}
                                </ImageButton>
                            )}

                            <SongRefreshBtn onClick={refresh_song} />
                        </Fragment>
                    }
                >
                    <FavouriteButton song={song} />

                    {set_id ? (
                        <ImageButton component={Link} to={`/song/${requested_song_id}`} icon={Icon.ExitSet}>
                            {t('exit_set')}
                        </ImageButton>
                    ) : (
                        <ImageButton onClick={show_add_to_set} icon={Icon.AddToSet}>
                            {t('add_to_set')}
                        </ImageButton>
                    )}

                    {display_lyrics && <SongPresentBtn show_dialog={do_show_present} enter_single_presentor_mode={enter_single_presentor_mode} />}

                    <ImageButton onClick={show_share} icon={Icon.Share}>
                        {t('sharebtn')}
                    </ImageButton>
                </TopBar>

                {show_scroller && <MobileScroller update_refs={(fn) => (update_item_refs_ref.current = fn ?? undefined)} />}

                {add_to_set && song && <DialogAddToSet transpose={transposePayload} song_id={song.id} onClose={() => setAddToSet(false)} />}
                {show_present && <DialogPresent enter_single_presentor_mode={enter_single_presentor_mode} />}
                {share_link && (
                    <PageSharer
                        url={share_link}
                        title={t('share_title')}
                        subject={t('share_subject')}
                        onClose={(did_share) => {
                            if (did_share && song) song_feedback('share', song.id);
                            setShareLink(undefined);
                        }}
                    />
                )}
                {show_copy && song && <PageCopyTextarea song={song} onClose={() => setShowCopy(false)} />}
                {show_edit && <PageEditTextarea type={show_edit} song={show_edit === 'new' ? undefined : song} onClose={() => setShowEdit(undefined)} />}

                {song && set_id && <SetPrevNext song_id={song.id} set_switcher={set_switcher} />}

                {!song && requested_song_id && !song_loading && (
                    <p style={{ fontWeight: 'bold' }}>
                        {t('unknown-song')} (i{requested_song_id})
                    </p>
                )}

                {song_display}
            </Box>
        </Fragment>
    );
};
