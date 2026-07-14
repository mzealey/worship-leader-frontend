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
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
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
import type { Album, MaybeLoadedSong, RelatedSong, Song, SongShortData, SongSource } from '../song';
import { get_text_title } from '../song-utils';
import type { UnknownArgs } from '../util';
import { ensure_visible, format_string, is_rtl, is_vertical_lang, scroll_to } from '../util';
import * as Icon from './icons';

interface TextDirectionProps extends React.HTMLAttributes<HTMLSpanElement> {
    text?: string;
    lang?: string;
    is_main_block?: boolean;
}

export const TextDirection = ({ text, lang, is_main_block, children, className, ...other_props }: TextDirectionProps) => {
    const dir = is_rtl(text || preact_get_text(children)) ? 'rtl' : 'ltr';
    return (
        <span {...other_props} lang={lang} dir={dir} className={clsx(className, { 'vertical-lr vertical-lr-scroll': is_main_block && is_vertical_lang(lang) })}>
            {children}
        </span>
    );
};

const secondaryActionSx = {
    position: 'static',
    transform: 'none',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    pl: 1,
} as const;

const childrenBoxSx = { ml: 1 } as const;

const loaderSx = { textAlign: 'center' } as const;

const pagerGridSx = { alignItems: 'center', justifyContent: 'space-between' } as const;

const pagerGrowSx = { flexGrow: 1 } as const;

interface FavouriteSymbolProps {
    songId: number;
}

const FavouriteSymbol = memo(function FavouriteSymbol({ songId }: FavouriteSymbolProps) {
    const [isFavourite, setIsFavourite] = useState(false);

    useEffect(() => {
        const updateFavourite = () => {
            setIsFavourite(!!FAVOURITE_DB.get_favourite(songId));
        };

        const watcher = FAVOURITE_DB.subscribe((sid: number) => {
            if (sid === songId) updateFavourite();
        });
        updateFavourite();

        return () => {
            watcher.unsubscribe();
        };
    }, [songId]);

    return isFavourite ? <Icon.SymbolFavourite /> : null;
});

interface SongListLinkHeaderProps {
    prefix?: React.ReactNode;
    song: MaybeLoadedSong | RelatedSong;
    children?: React.ReactNode;
}

const SongListLinkHeader = memo(function SongListLinkHeader({ prefix, song, children }: SongListLinkHeaderProps) {
    const { t } = useTranslation();
    const { appLang } = useAppLang();
    const [display_chords] = useSetting('display-chords');
    const [showKeyInList] = useSetting('show-key-in-list');

    const stopClicks = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
    }, []);

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

    const fullSong = song as Song;

    const title = get_text_title(fullSong);
    const whiteSpaceStyle = { whiteSpace: 'nowrap' as const };

    const titleElement = (
        <TextDirection {...whiteSpaceStyle} text={title} lang={fullSong.lang} title={title}>
            {title}
        </TextDirection>
    );

    const fullTitle = prefix ? (
        <span {...whiteSpaceStyle}>
            {prefix}
            {titleElement}
        </span>
    ) : (
        titleElement
    );

    const sec_props = children ? { onClick: stopClicks } : {};

    const key_items: string[] = [];
    if (showKeyInList) {
        if (fullSong.songkey) key_items.push(t('songkey') + ': ' + fullSong.songkey);

        if (fullSong.info) {
            const timesig = fullSong.info.find((d) => d.type === 'timesignature');
            if (timesig) key_items.push(timesig.value);

            const tempo = fullSong.info.find((d) => d.type === 'tempo');
            if (tempo) key_items.push(t('tempo') + ': ' + tempo.value);
        }
    }

    const alts = (fullSong.alternative_titles || []).join(', ');
    return (
        <Fragment>
            <ListItemText
                primary={fullTitle}
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
                slotProps={{ secondary: { color: 'initial' } }}
            />

            <ListItemSecondaryAction {...sec_props} sx={secondaryActionSx}>
                <FavouriteSymbol songId={fullSong.id} />
                {!!fullSong.is_original && <Icon.SymbolOriginal />}
                {!!fullSong.has_chord && display_chords ? <Icon.SymbolHasChord /> : null}
                {!!fullSong.has_mp3 && <Icon.SymbolHasMP3 />}
                {!!fullSong.has_sheet && <Icon.SymbolHasSheet />}
                {children ? (
                    <Box component="span" sx={childrenBoxSx}>
                        {children}
                    </Box>
                ) : null}
            </ListItemSecondaryAction>
        </Fragment>
    );
});

interface SongListLinkProps {
    withStripe?: boolean;
    realRef?: React.Ref<any>;
    prefix?: React.ReactNode;
    song: SongShortData | RelatedSong;
    is_active?: boolean;
    children?: React.ReactNode;
    set_id?: number;
    noAddToSet?: boolean;
}

export const SongListLink = memo(
    function SongListLink({ withStripe, realRef, prefix, song, is_active, children, set_id, noAddToSet }: SongListLinkProps) {
        const [addToSet, setAddToSet] = useState(false);

        const handleAddToSet = useCallback(
            (e: React.MouseEvent) => {
                e.preventDefault();
                if (!noAddToSet) setAddToSet(true);
            },
            [noAddToSet],
        );

        const path = set_id ? `/song/${song.id}/${set_id}` : `/song/${song.id}`;

        return (
            <Fragment>
                {addToSet ? <DialogAddToSet song_id={song.id} onClose={() => setAddToSet(false)} /> : null}
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
    },
    (prevProps, nextProps) =>
        prevProps.song.id === nextProps.song.id &&
        prevProps.is_active === nextProps.is_active &&
        prevProps.withStripe === nextProps.withStripe &&
        prevProps.prefix === nextProps.prefix &&
        prevProps.children === nextProps.children &&
        prevProps.set_id === nextProps.set_id &&
        prevProps.noAddToSet === nextProps.noAddToSet,
);

interface AlbumMetaLinkProps {
    meta: Album;
}

function AlbumMetaLink({ meta }: AlbumMetaLinkProps) {
    const onclick = () => set_search_text(`album_id=${meta.id}`);

    return (
        <ListItem
            disablePadding
            sx={(theme) => ({
                backgroundColor: theme.palette.searchChip.album.background,
                borderColor: theme.palette.searchChip.album.border,
                '&:hover': { backgroundColor: theme.palette.searchChip.album.hover },
            })}
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
            sx={(theme) => ({
                backgroundColor: theme.palette.searchChip.source.background,
                borderColor: theme.palette.searchChip.source.border,
                '&:hover': { backgroundColor: theme.palette.searchChip.source.hover },
            })}
        >
            <ListItemButton onClick={onclick}>
                <ListItemText
                    primary={
                        <TextDirection lang={meta.lang}>
                            {meta.name} {meta.abbreviation ? `(${meta.abbreviation})` : null}
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
        <Grid container sx={pagerGridSx}>
            <IconButton color="primary" style={{ visibility: pager.has_prev() ? 'visible' : 'hidden' }} onClick={pager_prev} aria-label={t('pager_prev')}>
                <Icon.Prev />
            </IconButton>

            <Box sx={pagerGrowSx}>
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
        const cur_search = useSearchStore.getState().current_search;
        if (cur_search && cur_search.isEqual(db)) return;

        new DBSearch(db).run();
    });
};
useSearchStore.subscribe(rerun_search);
on_db_languages_update.subscribe(rerun_search);
rerun_search();

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

    const scroll_to_active_id = useCallback(() => {
        if (!songlist_ref.current) return;

        const active = songlist_ref.current.querySelector(`.songid-${active_song_id}`) as HTMLElement | null;
        if (active) {
            const parent = container === document || !container ? undefined : (container as HTMLElement);
            ensure_visible(active, parent, 500);
        }
    }, [active_song_id, container]);

    const scroll_to_top = useCallback(() => {
        if (container) scroll_to(container === document ? document.documentElement : (container as HTMLElement), 0, 500);
    }, [container]);

    const set_songlist = useCallback((e: HTMLUListElement | null) => {
        songlist_ref.current = e;
    }, []);

    const remove_infinite_watcher = useCallback(() => {
        if (infinite_watcher_ref.current) {
            const [scroll_container, debouncer] = infinite_watcher_ref.current;
            scroll_container.removeEventListener('scroll', debouncer);
            if (on_resize_ref.current) {
                on_resize_ref.current.unsubscribe();
                on_resize_ref.current = null;
            }
            infinite_watcher_ref.current = null;
        }
    }, []);

    const setup_infinite_scroll = useCallback(() => {
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
    }, [container, current_search, remove_infinite_watcher]);

    const watch_current_search = useCallback(() => {
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
    }, [current_search]);

    // Initial mount + current_search change
    useEffect(() => {
        setup_infinite_scroll();
        watch_current_search();

        return () => {
            remove_infinite_watcher();
            if (watcher_ref.current) {
                watcher_ref.current.unsubscribe();
            }
        };
    }, [setup_infinite_scroll, watch_current_search, remove_infinite_watcher]);

    useEffect(() => {
        scroll_to_active_id();
    }, [scroll_to_active_id]);

    const on_first_page = !requested_items?.infinite_scroll || requested_items?.start == 0;

    const loader = (
        <Box sx={loaderSx}>
            <CircularProgress />
        </Box>
    );
    if (show_spinner && !infinite_scroll) return loader;

    return (
        <Fragment>
            <PagerElem current_search={current_search} on_change={scroll_to_top} />

            {!is_loading && on_first_page && items.length == 0 ? <p style={{ fontWeight: 'bold' }}>{t('noresults')}</p> : null}
            {(infinite_scroll || !show_spinner) && items.length > 0 ? (
                <List ref={set_songlist} disablePadding>
                    {items.map((item, idx: number) =>
                        '_type' in item ? (
                            <MetaLink withStripe={idx % 2 == 0} key={`${item._type}${item.id}`} meta={item} />
                        ) : (
                            <SongListLink withStripe={idx % 2 == 0} key={item.id} is_active={item.id == active_song_id} song={item as SongShortData} />
                        ),
                    )}
                </List>
            ) : null}

            {show_spinner ? loader : null}

            <PagerElem current_search={current_search} on_change={scroll_to_top} />
        </Fragment>
    );
}
