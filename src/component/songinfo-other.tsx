import {
    Box,
    Button,
    ButtonGroup,
    Dialog,
    DialogActions,
    DialogContent,
    GlobalStyles,
    Grid,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    NativeSelect,
    Tab,
    Tabs,
    Typography,
} from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { can_do_worker } from '../abc2svg';
import { DialogTitleWithClose, ImageButton } from '../component/basic';
import { PresenterView } from '../component/presenter-view';
import { SheetMusicDisplay } from '../component/score';
import { SearchArea } from '../component/search-area';
import { SongList } from '../component/song-list';
import { CapoChange, ChordSelect } from '../component/songinfo-chords';
import { PrintCapoDisplay, SongTopInfoSection } from '../component/songinfo-sidebar';
import { SongXMLDisplay } from '../component/songxml';
import { Theme } from '../component/theme';
import { DB, on_db_change } from '../db';
import { PresentationCommon, get_presentation, useCast } from '../dual-present';
import { useTranslation } from '../langpack';
import { usePagePadding } from '../page-padding';
import { Fragment, Link, useDialog } from '../preact-helpers';
import { SET_DB } from '../set-db';
import type { SetSwitcher } from '../set-switcher';
import { useSetting } from '../settings-store';
import { Song } from '../song';
import { get_text_title } from '../song-utils';
import type { TransposeDetails } from '../transpose-details';
import { format_string, is_rtl, is_vertical_lang, scroll_to } from '../util';
import * as Icon from './icons';

export const DialogPresent = ({ enter_single_presentor_mode }: { enter_single_presentor_mode: () => void }) => {
    const { t } = useTranslation();
    const [presentation, setPresentation] = useState<PresentationCommon | undefined>(undefined);
    const { closed, handleClose } = useDialog();

    useEffect(() => {
        get_presentation().then((presentation) => setPresentation(presentation));
    }, []);

    return (
        <Dialog open={!closed} onClose={handleClose}>
            <DialogTitleWithClose handleClose={handleClose}>{t('present-choose')}</DialogTitleWithClose>
            <DialogContent>
                <List>
                    <ListItem divider disablePadding>
                        <ListItemButton
                            onClick={() => {
                                handleClose();
                                enter_single_presentor_mode();
                            }}
                        >
                            <ListItemIcon>
                                <Icon.PresentFullScreen />
                            </ListItemIcon>
                            <ListItemText primary={t('present-monitor')} />
                        </ListItemButton>
                    </ListItem>
                    {presentation && (
                        <ListItem divider disablePadding>
                            <ListItemButton
                                onClick={() => {
                                    handleClose();
                                    presentation.enter_cast_mode();
                                }}
                            >
                                <ListItemIcon>
                                    <Icon.PresentCast />
                                </ListItemIcon>
                                <ListItemText primary={t('present-cast')} />
                            </ListItemButton>
                        </ListItem>
                    )}
                </List>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>{t('cancel_btn')}</Button>
            </DialogActions>
        </Dialog>
    );
};

export const SongRefreshBtn = ({ onClick }: { onClick: () => void }) => {
    const { t } = useTranslation();
    const [db_type, setDbType] = useState<string | undefined>(undefined);

    useEffect(() => {
        const watcher = on_db_change.subscribe(() => {
            DB.then((db) => setDbType(db.type()));
        });
        DB.then((db) => setDbType(db.type()));

        return () => {
            watcher.unsubscribe();
        };
    }, []);

    if (db_type !== 'offline') return null;

    return (
        <ImageButton onClick={onClick} icon={Icon.ReloadSong}>
            {t('refreshbtn')}
        </ImageButton>
    );
};

export const SongPresentBtn = ({ show_dialog, enter_single_presentor_mode }: { show_dialog: () => void; enter_single_presentor_mode: () => void }) => {
    const { t } = useTranslation();
    const cast_active = useCast((state) => state.active);
    const cast_available = useCast((state) => state.available);
    const [presentation, setPresentation] = useState<PresentationCommon | undefined>(undefined);

    useEffect(() => {
        get_presentation().then((presentation) => setPresentation(presentation));
    }, []);

    const toggle_cast = () => {
        if (presentation && presentation.is_casting()) presentation.exit_cast_mode();
        else if (cast_available) show_dialog();
        else enter_single_presentor_mode();
    };

    return (
        <ImageButton
            onClick={toggle_cast}
            icon={cast_active ? Icon.ExitPresent : Icon.Present}
            variant={cast_active ? 'contained' : 'text'}
            color={cast_active ? 'secondary' : undefined}
            iconColor={cast_available && !cast_active ? 'primary' : 'inherit'}
        >
            {t('present-btn')}
        </ImageButton>
    );
};

export const SetPrevNext = ({ song_id: _song_id, set_switcher }: { song_id: number; set_switcher?: SetSwitcher }) => {
    const { t } = useTranslation();
    const [title, setTitle] = useState('');

    useEffect(() => {
        if (set_switcher) {
            SET_DB.get_set_title(set_switcher.set_id).then((title) => setTitle(title));
        }
    }, [set_switcher]);

    if (!set_switcher) return null;

    const position = set_switcher.position();
    return (
        <Grid container justifyContent="space-between" alignItems="center">
            <Box displayPrint="none" visibility={set_switcher.can_prev() ? 'visible' : 'hidden'}>
                <Button component={Link} to={`/song/${set_switcher.move(-1)}/${set_switcher.set_id}`}>
                    {t('pager_prev')}
                </Button>
            </Box>

            <Box flexGrow={1}>
                <Typography align="center" variant="h6">
                    {format_string(t('set_title') + ': {0}', title)} {position > -1 && `(${position + 1})`}
                </Typography>
            </Box>

            <Box displayPrint="none" visibility={set_switcher.can_next() ? 'visible' : 'hidden'}>
                <Button component={Link} to={`/song/${set_switcher.move(1)}/${set_switcher.set_id}`}>
                    {t('pager_next')}
                </Button>
            </Box>
        </Grid>
    );
};

const presentationGlobalStyles = {
    html: {
        backgroundColor: 'black',

        // ie scroll bars
        'scrollbar-base-color': '#444',
        'scrollbar-track-color': 'black',
        'scrollbar-arrow-color': 'black',
    },
    ':root': {
        // chrome scroll bars
        '& ::-webkit-scrollbar': {
            height: '12px !important',
            width: '12px !important',
            backgroundColor: 'black !important',
        },
        '& ::-webkit-scrollbar-track': {
            backgroundColor: 'black !important',
        },

        '& ::-webkit-scrollbar-thumb': {
            backgroundColor: '#333 !important',
            //'-webkit-box-shadow': '0px 1px 2px rgba(0, 0, 0, 0.75)',
        },

        /*
        '&::-webkit-scrollbar-corner': {
            backgroundColor: 'black'
        },
        */
    },
};

interface PresentationMoverProps {
    set_switcher?: SetSwitcher;
    exit_single_presentor_mode?: () => void;
}

const PresentationMover: React.FC<PresentationMoverProps> = ({ set_switcher, exit_single_presentor_mode }) => {
    return (
        <Fragment>
            <GlobalStyles styles={presentationGlobalStyles} />
            {set_switcher && set_switcher.can_prev() && (
                <IconButton
                    component={Link}
                    to={`/song/${set_switcher.move(-1)}/${set_switcher.set_id}`}
                    sx={{
                        position: 'fixed',
                        cursor: 'pointer',
                        color: '#777',
                        '&:hover': { color: '#ddd' },
                        left: 0,
                        top: 0,
                    }}
                >
                    <Icon.Prev />
                </IconButton>
            )}
            {set_switcher && set_switcher.can_next() && (
                <IconButton
                    component={Link}
                    to={`/song/${set_switcher.move(1)}/${set_switcher.set_id}`}
                    sx={{
                        position: 'fixed',
                        cursor: 'pointer',
                        color: '#777',
                        '&:hover': { color: '#ddd' },
                        right: 0,
                        top: 0,
                    }}
                >
                    <Icon.Next />
                </IconButton>
            )}
            {exit_single_presentor_mode && (
                <IconButton
                    onClick={exit_single_presentor_mode}
                    sx={{
                        position: 'fixed',
                        cursor: 'pointer',
                        color: '#777',
                        '&:hover': { color: '#ddd' },
                        right: 0,
                        bottom: 0,
                    }}
                >
                    <Icon.Close />
                </IconButton>
            )}
        </Fragment>
    );
};

export const sidebar_width = 320;

export const SongPageSidebar = ({ active_song_id }: { active_song_id: number }) => {
    const verticalPagePadding = usePagePadding((state) => state.bottom + state.top);
    const [sidebar, setSidebar] = useState<HTMLDivElement | null>(null);
    const set_sidebar = useCallback((e: HTMLDivElement | null) => setSidebar(e), []);

    return (
        <Box
            position="fixed"
            display="flex"
            flexDirection="column"
            displayPrint="none"
            sx={(theme) => ({
                width: `${sidebar_width}px`,
                borderRight: `1px solid ${theme.palette.border.main}`,
            })}
            style={{ height: `calc(100vh - ${verticalPagePadding}px)` }}
        >
            <SearchArea thin />

            <Box position="relative" flexGrow={1}>
                <Box
                    ref={set_sidebar}
                    position="absolute"
                    top={0}
                    left={0}
                    right={0}
                    bottom={0}
                    sx={{
                        overflowX: 'hidden',
                        overflowY: 'auto',
                    }}
                >
                    <SongList active_song_id={active_song_id} container={sidebar} />
                </Box>
            </Box>
        </Box>
    );
};

const MouseHider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [hide_mouse, setHideMouse] = useState(false);
    const last_mouse_move = useRef<number>(0);

    const on_mouse_move = () => {
        last_mouse_move.current = Date.now();
        if (hide_mouse) {
            setHideMouse(false);
        }
    };

    useEffect(() => {
        last_mouse_move.current = Date.now();

        const hide_cursor_interval = window.setInterval(() => {
            // Hide the mouse after a certain time of no movement. Some devices such as apple don't do this automatically
            if (Date.now() - last_mouse_move.current > 200 && !hide_mouse) setHideMouse(true);
        }, 1000);

        return () => {
            window.clearInterval(hide_cursor_interval);
        };
    }, [hide_mouse]);

    // TODO: make this apply to songxml too ?
    return (
        <div style={{ cursor: hide_mouse ? 'none !important' : '' }} onMouseMove={on_mouse_move}>
            {children}
        </div>
    );
};

interface SongsDisplayProps {
    song?: Song;
    in_presentation?: boolean;
    related_songs?: Song[];
    song_loading?: boolean;
    transpose?: TransposeDetails;
    is_printing?: boolean;
    set_switcher?: SetSwitcher;
    set_id?: number;
    update_item_refs: (name: string, e: HTMLElement | null) => void;
    exit_single_presentor_mode?: () => void;
    set_presentation_area?: (e: HTMLDivElement | null) => void;
    children?: React.ReactNode;
}
export const SongsDisplay = ({
    song,
    in_presentation,
    related_songs,
    song_loading,
    transpose,
    is_printing,
    set_switcher,
    set_id,
    update_item_refs,
    exit_single_presentor_mode,
    set_presentation_area,
    children,
}: SongsDisplayProps) => {
    const { t, lang_name } = useTranslation();
    const [setting_sidebyside] = useSetting('sidebyside');
    const [sec_id, setSecId] = useState<number | undefined>(undefined);
    const [sec_song, setSecSong] = useState<Song | null>(null);
    const [prefer_score, setPreferScore] = useState<number>(0);

    // Some helper functions...
    const abc_file = (): Song['files'][number] | undefined => (song ? song.files || [] : []).find((file: Song['files'][number]) => file.type == 'abccache');
    const has_score = () => !!abc_file();
    const is_copyright_restrict = () => 0; /*is_copyright(song)*/ // TODO
    const is_show_score = () => has_score() && !!prefer_score && can_do_worker() && !is_copyright_restrict();
    const use_sidebyside = () => setting_sidebyside && !is_show_score() && !set_id;

    const update_sec_display = useCallback((newSecId: number) => {
        console.log('showing sec', newSecId);
        setSecId(newSecId);
        DB.then((db) => db.get_song(newSecId)).then((sec_song) => setSecSong(sec_song));
    }, []);

    useEffect(() => {
        if (song) {
            setSecSong(null);
            setSecId(undefined);
        }
    }, [song]);

    useEffect(() => {
        if (related_songs && use_sidebyside() && related_songs.length) {
            // If we are doing side-by-side ensure that we have a sec_id
            // and that it is in the list of related songs, otherwise reset
            // it to the first one.
            let newSecId = sec_id;
            if (!newSecId || !related_songs.filter((s) => s.id == newSecId).length) newSecId = related_songs[0].id;

            update_sec_display(newSecId);
        }
    }, [related_songs, sec_id, update_sec_display, use_sidebyside]);

    useEffect(() => {
        scroll_to(document.documentElement, 0, 500);
    }, [prefer_score]);

    const sec_change = (e: React.ChangeEvent<HTMLSelectElement>) => update_sec_display(parseInt(e.target.value, 10));
    const tab_change = (_event: React.SyntheticEvent, value: number) => setPreferScore(value);

    const show_score = is_show_score();
    const is_vertical = song && is_vertical_lang(song.lang);
    const is_rtl_song = song && is_rtl(song.songxml);
    const abc_file_obj = abc_file(); // TODO: In future can change this to a chooser somehow if there are multiple musics

    const setup_chord_boxes = !!song?.songxml && (has_score() || /<chord>/i.test(song.songxml));

    const primary_song_display = show_score ? (
        <SheetMusicDisplay song={song} transpose={transpose} is_printing={is_printing} abc_file={abc_file_obj} in_presentation={in_presentation} />
    ) : (
        <SongXMLDisplay song={song} transpose={transpose} is_printing={is_printing} no_chords={in_presentation} in_presentation={in_presentation} />
    );

    return (
        <Box display={song ? 'flex' : 'hidden'} flexGrow="1" displayPrint="block" ref={(e) => update_item_refs('song', e as HTMLElement | null)}>
            <Box
                component="div"
                sx={{
                    display: 'none',
                    '@media only print': {
                        display: 'block',
                    },
                    ...(!(show_score || is_vertical) && {
                        marginTop: 1.25,
                        writingMode: 'vertical-lr',
                    }),
                    ...(is_rtl_song
                        ? {
                              marginRight: 2.5,
                              float: 'left',
                          }
                        : {
                              marginLeft: 2.5,
                              float: 'right',
                          }),
                }}
            >
                {t('print_ad')}
            </Box>

            <Box
                className="song-and-details"
                flexGrow="1"
                sx={{
                    ...((!song || song_loading) && {
                        // Hide the main page when loading, but allow layout of chords and sheet music to happen rather than a display: none
                        opacity: 0,
                    }),
                }}
            >
                <div className="songs">
                    <Box displayPrint="none">
                        {has_score() && (
                            <Tabs value={prefer_score} variant="fullWidth" centered textColor="primary" indicatorColor="primary" onChange={tab_change}>
                                <Tab
                                    value={0}
                                    icon={<Icon.SymbolHasChord />}
                                    label={<span style={{ flexGrow: 1, textAlign: 'center' }}>{t('song-switch-songxml')}</span>}
                                />
                                <Tab
                                    value={1}
                                    icon={<Icon.SymbolHasSheet />}
                                    label={<span style={{ flexGrow: 1, textAlign: 'center' }}>{t('song-switch-sheet')}</span>}
                                />
                            </Tabs>
                        )}
                    </Box>

                    <div className="flex">
                        <Box mx={1}>
                            <PresenterView song={song!} />

                            <PrintCapoDisplay transpose={transpose} />
                            <Box displayPrint="none">
                                <Grid spacing={2} container justifyContent="space-evenly">
                                    {transpose && (
                                        <Grid>
                                            <CapoChange song_id={song!.id} set_switcher={set_switcher} transpose={transpose} />
                                        </Grid>
                                    )}
                                    {setup_chord_boxes && transpose && (
                                        <Grid>
                                            <ChordSelect set_switcher={set_switcher} song={song} transpose={transpose} />
                                        </Grid>
                                    )}
                                </Grid>
                            </Box>

                            {song && <SongTopInfoSection song={song} />}

                            <Box
                                component="div"
                                ref={set_presentation_area}
                                sx={{
                                    ...(in_presentation && {
                                        color: 'white',
                                        backgroundColor: 'black',
                                        overflow: 'auto', // this element becomes the root element now for scrolling
                                    }),
                                }}
                            >
                                {in_presentation ? (
                                    <MouseHider>
                                        <Box
                                            component="div"
                                            sx={{
                                                color: 'white',
                                                backgroundColor: 'black',
                                                overflow: 'auto',
                                            }}
                                        >
                                            <PresentationMover set_switcher={set_switcher} exit_single_presentor_mode={exit_single_presentor_mode} />

                                            {primary_song_display}
                                        </Box>
                                    </MouseHider>
                                ) : (
                                    primary_song_display
                                )}
                            </Box>
                        </Box>

                        {related_songs && related_songs.length > 0 && use_sidebyside() && (
                            <Box mx={1} displayPrint="none">
                                <Grid container>
                                    <IconButton
                                        color="primary"
                                        size="small"
                                        component={Link}
                                        to={`/song/${sec_id}`}
                                        onClick={() => setSecId(song!.id)}
                                        title={t('song_switch')}
                                    >
                                        <Icon.SwapSec fontSize="large" />
                                    </IconButton>
                                    <NativeSelect value={sec_id} onChange={sec_change}>
                                        {related_songs.map((song) => (
                                            <option key={song.id} value={song.id}>
                                                {lang_name(song.lang) + ': ' + get_text_title(song)}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                </Grid>
                                {sec_song && <SongXMLDisplay song={sec_song} transpose={transpose} />}
                            </Box>
                        )}
                    </div>
                </div>

                {children}
            </Box>
        </Box>
    );
};

const SCROLLER_HEIGHT = 40;

interface ScrollButtonProps extends React.ComponentProps<typeof Button> {
    active: boolean;
    icon: React.ElementType;
    title: string;
}

function ScrollButton({ active, icon: ThisIcon, title, ...props }: ScrollButtonProps) {
    const { t } = useTranslation();
    return (
        <Button
            {...props}
            sx={{
                transition: 'opacity 0.5s linear',
                whiteSpace: 'nowrap',
                width: 'auto',
                flexGrow: 1,
                ...(!active && {
                    opacity: 0.5,
                }),
            }}
        >
            <ThisIcon />
            {active && t(title)}
        </Button>
    );
}

export const MobileScroller: React.FC<{ update_refs: (callback?: (name: string, e: HTMLElement | null) => void) => void }> = ({ update_refs }) => {
    const [activeComponent, setActiveComponent] = useState<string | undefined>(undefined);
    const [section_refs, setSectionRefs] = useState<Record<string, HTMLElement | null>>({});
    const selfRef = useRef<HTMLDivElement | null>(null);

    const get_bottom = () => {
        if (!selfRef.current) return 0;

        return selfRef.current.offsetTop + selfRef.current.offsetHeight;
    };

    const update_buttons = useCallback(() => {
        const our_pos = document.documentElement.scrollTop + get_bottom();
        let closest: { offset: number; name: string } | undefined;
        for (const name in section_refs) {
            const ref = section_refs[name];
            if (!ref) continue;

            const offset = ref.offsetTop;
            if (our_pos >= offset && (!closest || offset > closest.offset)) closest = { offset, name };
        }

        if (closest && closest.name != activeComponent) setActiveComponent(closest.name);
    }, [section_refs, activeComponent]);

    const update_item_refs = useCallback(
        (name: string, e: HTMLElement | null) => {
            setSectionRefs((prev) => ({ ...prev, [name]: e }));
            update_buttons();
        },
        [update_buttons],
    );

    const scroll_to_section = (name: string) => {
        const ref = section_refs[name];
        if (ref && selfRef.current) scroll_to(document.documentElement, ref.offsetTop - get_bottom(), 400);
    };

    useEffect(() => {
        document.addEventListener('scroll', update_buttons);
        update_refs(update_item_refs);

        return () => {
            document.removeEventListener('scroll', update_buttons);
            update_refs();
        };
    }, [update_buttons, update_refs, update_item_refs]);

    const items = [
        {
            name: 'song',
            icon: Icon.SymbolHasChord,
        },
        {
            name: 'details',
            icon: Icon.Details,
        },
        {
            name: 'music',
            icon: Icon.SymbolHasMP3,
        },
        {
            name: 'videos',
            icon: Icon.Video,
        },
    ];

    return (
        <Box position="relative" displayPrint="none" ref={selfRef}>
            <Box
                position="fixed"
                sx={(theme) => ({
                    zIndex: theme.zIndex.appBar,
                    height: SCROLLER_HEIGHT,
                    width: '100%',
                    backgroundColor: theme.palette.background.paper,
                })}
            >
                <Theme section="Bottom">
                    <ButtonGroup
                        fullWidth
                        variant="contained"
                        color="primary"
                        sx={{
                            height: SCROLLER_HEIGHT,
                            display: 'flex',
                        }}
                    >
                        {items
                            .filter((item) => !!section_refs[item.name])
                            .map((item) => (
                                <ScrollButton
                                    key={item.name}
                                    active={activeComponent == item.name}
                                    icon={item.icon}
                                    title={item.name}
                                    onClick={() => scroll_to_section(item.name)}
                                />
                            ))}
                    </ButtonGroup>
                </Theme>
            </Box>
            <Box style={{ height: SCROLLER_HEIGHT }} />
        </Box>
    );
};
