import {
    Avatar,
    Box,
    CircularProgress,
    Grid,
    IconButton,
    List,
    ListItem,
    ListItemAvatar,
    ListItemButton,
    ListItemSecondaryAction,
    ListItemText,
    Typography,
} from '@mui/material';
import debounce from 'lodash/debounce';
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import unknown_album_icon from '../../img/unknown_album_icon.png';
import { DB, on_db_languages_update } from '../db';
import { DBSearch, useSearchStore, useSongListStore } from '../db-search';
import { FAVOURITE_DB } from '../favourite-db';
import { toggle_filter_source } from '../filter-sources';
import { useAppLang, useTranslation } from '../langpack';
import { DialogAddToSet } from '../page/add-to-set';
import { clsx, Fragment, preact_get_text } from '../preact-helpers';
import { on_resize } from '../resize-watcher';
import { set_search_text } from '../search';
import { useSetting } from '../settings-store';
import { Album, MaybeLoadedSong, RelatedSong, Song, SongSource } from '../song';
import { get_text_title } from '../song-utils';
import { ensure_visible, format_string, is_rtl, is_vertical_lang, scroll_to, UnknownArgs } from '../util';
import * as Icon from './icons';

interface TextDirectionProps extends React.HTMLAttributes<HTMLSpanElement> {
    text?: string;
    lang?: string;
    is_main_block?: boolean;
}

export const TextDirection = ({ text, lang, is_main_block, children, className, ...other_props }: TextDirectionProps) => {
    const dir = is_rtl(text || preact_get_text(children)) ? 'rtl' : 'ltr';

    // Set the vertical-lr class if mongolian (traditional) and is the song block
    return (
        <span {...other_props} lang={lang} dir={dir} className={clsx(className, { 'vertical-lr vertical-lr-scroll': is_main_block && is_vertical_lang(lang) })}>
            {children}
        </span>
    );
};

interface SongListLinkHeaderProps {
    prefix?: React.ReactNode;
    song: MaybeLoadedSong | RelatedSong;
    children?: React.ReactNode;
}

const SongListLinkHeader = ({ prefix, song, children }: SongListLinkHeaderProps) => {
    const { t } = useTranslation();
    const { appLang } = useAppLang();
    const [display_chords] = useSetting('display-chords');
    const [is_favourite, setIsFavourite] = useState(false);

    useEffect(() => {
        const updateFavourite = () => {
            setIsFavourite(!!FAVOURITE_DB.get_favourite(song.id));
        };

        const watcher = FAVOURITE_DB.subscribe((song_id: number) => {
            if (song_id === song.id) updateFavourite();
        });
        updateFavourite();

        return () => {
            watcher.unsubscribe();
        };
    }, [song.id]);

    if ('not_loaded' in song && song.not_loaded) {
        return (
            <ListItemText
                primary={
                    <TextDirection lang={appLang}>
                        ${t('unknown-song')} (i${song.id})
                    </TextDirection>
                }
            />
        );
    }

    // At this point song is Song (full type)
    const fullSong = song as Song;

    const get_full_title = (prefix?: React.ReactNode) => {
        let title = get_text_title(fullSong);
        const other_props = { style: { whiteSpace: 'nowrap' as const } };

        const titleElement = (
            <TextDirection {...other_props} text={title} lang={fullSong.lang} title={title}>
                {title}
            </TextDirection>
        );

        if (!prefix) return titleElement;

        // If prefix is set we'll hide the actual title and direction under a
        // different span. Unfortunately this means that if the UI direction and
        // the song direction are different the UI direction will be preferred so
        // by default we'll not do this.
        return (
            <span {...other_props}>
                {prefix}
                {titleElement}
            </span>
        );
    };

    const stopClicks = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
    };

    const sec_props = children ? { onClick: stopClicks } : {};

    const key_items: string[] = [];
    /* TODO
    if( is_set('setting-show-key-in-list') ) {
        if( fullSong.songkey )
            key_items.push( t('songkey') + ": " + fullSong.songkey );

        if( fullSong.info ) {
            let timesig = fullSong.info.filter( d => d.type == 'timesignature' )[0];
            if( timesig )
                key_items.push( timesig.value );

            let tempo = fullSong.info.filter( d => d.type == 'tempo' )[0];
            if( tempo )
                key_items.push( t('tempo') + ": " + tempo.value );
        }
    }
    */

    const alts = (fullSong.alternative_titles || []).join(', ');
    return (
        <Fragment>
            <ListItemText
                primary={get_full_title(prefix)}
                secondary={
                    <Fragment>
                        {alts.length > 0 ? (
                            <TextDirection lang={fullSong.lang} style={{ whiteSpace: 'nowrap' }}>
                                {alts}
                            </TextDirection>
                        ) : null}
                        {key_items.length > 0 && <p>{key_items.join(', ')}</p>}
                    </Fragment>
                }
                secondaryTypographyProps={{ color: 'initial' }}
            />

            <ListItemSecondaryAction
                {...sec_props}
                sx={{
                    position: 'static',
                    transform: 'none',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    pl: 1,
                }}
            >
                {is_favourite && <Icon.SymbolFavourite />}
                {!!fullSong.is_original && <Icon.SymbolOriginal />}
                {!!fullSong.has_chord && display_chords && <Icon.SymbolHasChord />}
                {!!fullSong.has_mp3 && <Icon.SymbolHasMP3 />}
                {!!fullSong.has_sheet && <Icon.SymbolHasSheet />}
                {children && (
                    <Box component="span" sx={{ ml: 1 }}>
                        {children}
                    </Box>
                )}
            </ListItemSecondaryAction>
        </Fragment>
    );
};

interface SongListLinkProps {
    withStripe?: boolean;
    realRef?: React.Ref<any>;
    prefix?: React.ReactNode;
    song: Song | RelatedSong;
    is_active?: boolean;
    children?: React.ReactNode;
    set_id?: number;
    noAddToSet?: boolean;
}

export const SongListLink = ({ withStripe, realRef, prefix, song, is_active, children, set_id, noAddToSet }: SongListLinkProps) => {
    const [addToSet, setAddToSet] = useState(false);

    // long-press on mobile devices will trigger add-to-set dialog
    const handleAddToSet = (e: React.MouseEvent) => {
        e.preventDefault();
        if (!noAddToSet) setAddToSet(true);
    };

    // On the links don't create clickable link if target song is copyrighted
    //if( !prefix || !is_copyright(song) )
    let path = `/song/${song.id}`;
    if (set_id) path += `/${set_id}`;

    return (
        <Fragment>
            {addToSet && <DialogAddToSet song_id={song.id} onClose={() => setAddToSet(false)} />}
            <ListItem
                disablePadding
                ref={realRef}
                component={Link}
                to={path}
                onContextMenu={handleAddToSet}
                className={clsx(withStripe && 'stripe', children && 'with-icons', `songid-${song.id}`)}
                sx={(theme) => ({
                    '&.stripe': {
                        backgroundColor: theme.palette.background.stripe,
                        '&:hover': {
                            backgroundColor: theme.palette.background.stripe_active,
                        },
                    },
                    '&.with-icons': {
                        pr: 0,
                        pt: 0,
                        pb: 0,
                    },
                })}
            >
                <ListItemButton selected={is_active}>
                    <SongListLinkHeader song={song} prefix={prefix}>
                        {children}
                    </SongListLinkHeader>
                </ListItemButton>
            </ListItem>
        </Fragment>
    );
};

interface AlbumMetaLinkProps {
    meta: Album;
}

function AlbumMetaLink({ meta }: AlbumMetaLinkProps) {
    const onclick = () => set_search_text(`album_id=${meta.id}`);

    return (
        <ListItem
            disablePadding
            sx={{
                // TODO
                backgroundColor: '#fadbd8',
                borderColor: '#C7A8A5',
                '&:hover': { backgroundColor: '#E1C2BF' },
            }}
        >
            <ListItemButton onClick={onclick}>
                <ListItemAvatar>
                    <Avatar src={meta.image_path || unknown_album_icon} />
                </ListItemAvatar>
                <ListItemText primary={<TextDirection lang={meta.lang}>{meta.title}</TextDirection>} />
            </ListItemButton>
        </ListItem>
    );
}

interface SongSourceMetaLinkProps {
    meta: SongSource;
}

function SongSourceMetaLink({ meta }: SongSourceMetaLinkProps) {
    const onclick = () => toggle_filter_source(meta.id, true, true);

    return (
        <ListItem
            disablePadding
            sx={{
                // TODO
                backgroundColor: '#d1f2eb',
                borderColor: '#9EBFB8',
                '&:hover': { backgroundColor: '#B8D9D2' },
            }}
        >
            <ListItemButton onClick={onclick}>
                <ListItemText
                    primary={
                        <TextDirection lang={meta.lang}>
                            {meta.name} {meta.abbreviation && `(${meta.abbreviation})`}
                        </TextDirection>
                    }
                />
            </ListItemButton>
        </ListItem>
    );
}

interface MetaLinkProps {
    meta: SongSource | Album;
    withStripe?: boolean;
}

function MetaLink({ meta, ...props }: MetaLinkProps) {
    const Elem = meta._type == 'album' ? AlbumMetaLink : SongSourceMetaLink;
    return <Elem meta={meta as any} {...props} />;
}

// As pager object updates frequently without notifications we need to keep on rerendering
interface PagerElemProps {
    current_search?: DBSearch;
    on_change: () => void;
}

export function PagerElem({ current_search, on_change }: PagerElemProps) {
    const { t } = useTranslation();
    const pager = useSongListStore((state) => state.pager);

    const pager_prev = () => {
        current_search?.change_page(-1);
        on_change();
    };

    const pager_next = () => {
        current_search?.change_page(1);
        on_change();
    };

    if (!pager || pager.no_results()) return null;

    return (
        <Grid alignItems="center" justifyContent="space-between" container>
            <IconButton color="primary" style={{ visibility: pager.has_prev() ? 'visible' : 'hidden' }} onClick={pager_prev} aria-label={t('pager_prev')}>
                <Icon.Prev />
            </IconButton>

            <Box sx={{ flexGrow: 1 }}>
                <Typography align="center">{format_string(t('pager'), pager.first(), pager.last(), pager.total < 0 ? '...' : pager.total)}</Typography>
            </Box>

            <IconButton color="primary" style={{ visibility: pager.has_next() ? 'visible' : 'hidden' }} onClick={pager_next} aria-label={t('pager_next')}>
                <Icon.Next />
            </IconButton>
        </Grid>
    );
}

const rerun_search = () => {
    DB.then((db) => {
        // Be lazy about getting/comparing the data, only do it after we can
        // execute the query straight away.
        let cur_search = useSearchStore.getState().current_search;
        if (cur_search && cur_search.isEqual(db)) return;

        new DBSearch(db).run();
    });
};
useSearchStore.subscribe(rerun_search);
on_db_languages_update.subscribe(rerun_search);

// Define the props that can be passed to SongList from outside
type ScrollContainer = HTMLElement | Document | null;

export interface SongListProps {
    container?: ScrollContainer;
    active_song_id?: number;
}

export function SongList({ container, active_song_id }: SongListProps) {
    const { t } = useTranslation();
    const current_search = useSearchStore((state) => state.current_search);
    const requested_items = useSongListStore((state) => state.requested_items);
    const items = useSongListStore((state) => state.items);

    const [is_loading, setIsLoading] = useState(false);
    const [show_spinner, setShowSpinner] = useState(false);
    const [infinite_scroll, setInfiniteScroll] = useState(false);

    type DebounceArgs = UnknownArgs;

    const infinite_watcher_ref = useRef<[HTMLElement | Document, (...args: DebounceArgs) => void] | null>(null);
    const on_resize_ref = useRef<{ unsubscribe: () => void } | null>(null);
    const spinner_timer_ref = useRef<number | null>(null);
    const watcher_ref = useRef<{ unsubscribe: () => void } | null>(null);
    const songlist_ref = useRef<HTMLUListElement | null>(null);
    const cur_infinite_promise_ref = useRef<Promise<unknown> | null>(null);

    const scroll_to_active_id = () => {
        if (!songlist_ref.current) return;

        const active = songlist_ref.current.querySelector(`.songid-${active_song_id}`) as HTMLElement | null;
        if (active) {
            const parent = container === document || !container ? undefined : (container as HTMLElement);
            ensure_visible(active, parent, 500);
        }
    };

    const scroll_to_top = () => {
        if (container) scroll_to(container === document ? document.documentElement : (container as HTMLElement), 0, 500);
    };

    const set_songlist = (e: HTMLUListElement | null) => {
        songlist_ref.current = e;
        scroll_to_active_id();
    };

    const remove_infinite_watcher = () => {
        if (infinite_watcher_ref.current) {
            const [scroll_container, debouncer] = infinite_watcher_ref.current;
            scroll_container.removeEventListener('scroll', debouncer);
            if (on_resize_ref.current) {
                on_resize_ref.current.unsubscribe();
                on_resize_ref.current = null;
            }
            infinite_watcher_ref.current = null;
        }
    };

    const setup_infinite_scroll = () => {
        remove_infinite_watcher();
        if (!container) return;

        const generate_debouncer = (e: HTMLElement, get_container_height: () => number) =>
            debounce(
                () => {
                    const scroll_top = e.scrollTop;
                    const bottom_scroll_top = e.scrollHeight - get_container_height();

                    let perc_scroll = scroll_top / bottom_scroll_top;
                    if (!bottom_scroll_top && !scroll_top) perc_scroll = 1;

                    if (!cur_infinite_promise_ref.current && perc_scroll > 0.8 && current_search) {
                        const promise = current_search.infinite_scroll();
                        if (promise) {
                            cur_infinite_promise_ref.current = promise;
                            promise.finally(() => {
                                cur_infinite_promise_ref.current = null;
                            });
                        }
                    }
                },
                200,
                { leading: true, trailing: true },
            );

        const debouncer =
            container === document
                ? generate_debouncer(document.documentElement, () => window.innerHeight)
                : generate_debouncer(container as HTMLElement, () => (container as HTMLElement).clientHeight);

        const target = container === document ? document : (container as HTMLElement);
        infinite_watcher_ref.current = [target, debouncer];
        target.addEventListener('scroll', debouncer);
        on_resize_ref.current = on_resize(debouncer);
    };

    const watch_current_search = () => {
        if (watcher_ref.current) {
            watcher_ref.current.unsubscribe();
            watcher_ref.current = null;
        }

        if (current_search) {
            watcher_ref.current = current_search.subscribe(({ state, infinite_scroll }: { state: string; infinite_scroll?: boolean }) => {
                const loading = state == 'running';
                setIsLoading(loading);
                setInfiniteScroll(!!infinite_scroll);

                if (loading) {
                    spinner_timer_ref.current = window.setTimeout(() => {
                        setShowSpinner(true);
                        spinner_timer_ref.current = null;
                    }, 100);
                } else if (spinner_timer_ref.current) {
                    window.clearTimeout(spinner_timer_ref.current);
                    spinner_timer_ref.current = null;
                } else {
                    setShowSpinner(false);
                }
            });
        }
    };

    // Initial mount
    useEffect(() => {
        setup_infinite_scroll();
        watch_current_search();
        scroll_to_active_id();

        return () => {
            remove_infinite_watcher();
            if (watcher_ref.current) {
                watcher_ref.current.unsubscribe();
            }
        };
    }, []);

    // Watch for current_search changes
    useEffect(() => {
        watch_current_search();
    }, [current_search]);

    // Watch for container changes
    useEffect(() => {
        setup_infinite_scroll();
    }, [container]);

    // Watch for container or active_song_id changes
    useEffect(() => {
        scroll_to_active_id();
    }, [container, active_song_id]);

    const on_first_page = !requested_items?.infinite_scroll || requested_items?.start == 0;

    const loader = (
        <Box textAlign="center">
            <CircularProgress />
        </Box>
    );
    if (show_spinner && !infinite_scroll) return loader;

    return (
        <Fragment>
            <PagerElem current_search={current_search} on_change={scroll_to_top} />

            {!is_loading && on_first_page && items.length == 0 && <p style={{ fontWeight: 'bold' }}>{t('noresults')}</p>}
            {(infinite_scroll || !show_spinner) && items.length > 0 && (
                <List ref={set_songlist} disablePadding>
                    {items.map((item, idx: number) =>
                        '_type' in item ? (
                            <MetaLink withStripe={idx % 2 == 0} key={`${item._type}${item.id}`} meta={item} />
                        ) : (
                            <SongListLink withStripe={idx % 2 == 0} key={item.id} is_active={item.id == active_song_id} song={item as Song} />
                        ),
                    )}
                </List>
            )}

            {show_spinner && loader}

            <PagerElem current_search={current_search} on_change={scroll_to_top} />
        </Fragment>
    );
}
