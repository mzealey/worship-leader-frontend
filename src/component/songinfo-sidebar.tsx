import { Box, Button, Grid, List, ListItem, ListItemButton, ListItemText, Rating, Typography, useTheme } from '@mui/material';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import type { TypographyProps } from '@mui/material/Typography';
import type { ComponentType, ReactNode, SyntheticEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Subscription } from 'rxjs';
import { AudioPlayer } from '../component/audio-player';
import { DropDownIcon, ImageButton } from '../component/basic';
import { TagsSection } from '../component/tags-section';
import { eventSocket } from '../event-socket';
import { FAVOURITE_DB } from '../favourite-db';
import { file_feedback, song_feedback } from '../feedback';
import { try_window_open_download } from '../file-download-utils';
import { toggle_filter_source } from '../filter-sources';
import { get_host } from '../globals';
import { useTranslation } from '../langpack';
import { persistentStorage } from '../persistent-storage.es5';
import { Fragment } from '../preact-helpers';
import { set_search_text } from '../search';
import { useSetting } from '../settings-store';
import { maybe_convert_solfege } from '../solfege-util';
import { AlbumSong, RelatedSong, Song, type SongFile } from '../song';
import type { TransposeDetails } from '../transpose-details';
import { format_string, get_youtube_id } from '../util';
import * as Icon from './icons';
import { SongListLink, TextDirection } from './song-list';

const rating_event = eventSocket.add_queue('rating', 500);

type AudioSectionItem = {
    file: SongFile;
    song: Song;
};

type SheetMusicItem = AudioSectionItem & { dl_href: string };

type VideoSectionItem = AudioSectionItem & { youtube_id: string };

type SongInfoEntry = {
    type: string;
    value: string;
};

interface InfoLineProps extends TypographyProps<'div'> {
    label: string;
    children: ReactNode;
}

function InfoLine({ label, children, ...props }: InfoLineProps) {
    return (
        <Typography component="div" {...props}>
            <span style={{ fontWeight: 500 }}>{label}</span>: {children}
        </Typography>
    );
}

export const PrintCapoDisplay = ({ transpose }: { transpose?: TransposeDetails | null }) => {
    const { t } = useTranslation();
    const [capo, setCapo] = useState(0);
    const [key, setKey] = useState<TransposeDetails['key'] | undefined>(undefined);
    const [is_minor, setIsMinor] = useState(false);
    const watcherRef = useRef<Subscription | null>(null);

    const transpose_updated = useCallback(() => {
        setCapo(transpose ? transpose.capo : 0);
        setKey(transpose ? transpose.key : undefined);
        setIsMinor(!!(transpose ? transpose.is_minor : 0));
    }, [transpose]);

    useEffect(() => {
        watcherRef.current?.unsubscribe();
        if (transpose) {
            watcherRef.current = transpose.subscribe(transpose_updated);
        } else {
            watcherRef.current = null;
        }
        transpose_updated();

        return () => {
            watcherRef.current?.unsubscribe();
            watcherRef.current = null;
        };
    }, [transpose, transpose_updated]);

    return (
        <Box display="none" displayPrint="block">
            {capo > 0 && <InfoLine label={t('capo')}>{capo}</InfoLine>}
            {key && (
                <InfoLine label={t('key')}>
                    {maybe_convert_solfege(key.name)}
                    {is_minor ? 'm' : ''}
                </InfoLine>
            )}
        </Box>
    );
};

const TopImage = ({ img }: { img?: string }) => {
    const [show_img, setShowImg] = useState(false);

    useEffect(() => {
        setShowImg(false);
    }, [img]);

    const show_img_handler = () => setShowImg(true);

    const horiz_margin = 18,
        vert_margin = 18;
    const viewBox = [-horiz_margin, -vert_margin, 2 * horiz_margin + Icon._logo_width, 2 * vert_margin + Icon._logo_height].join(' ');

    // TODO: kapak/large
    return (
        <Fragment>
            {img && (
                <Box
                    component="img"
                    src={img.replace(/kapak\//, 'kapak/large/')}
                    onLoad={show_img_handler}
                    sx={{
                        margin: 'auto',
                        width: '100%',
                        maxWidth: 400,
                        display: show_img ? 'block' : 'none',
                        '@media only print': { display: 'none' },
                    }}
                />
            )}
            {!show_img && (
                <Icon.Logo
                    viewBox={viewBox}
                    sx={(theme) => ({
                        backgroundColor: theme.palette.primary.main,
                        color: theme.palette.primary.contrastText,
                        width: '100%',
                        display: 'block',
                        margin: 'auto',
                        height: 'auto',
                        maxWidth: 400,
                        '@media only print': { display: 'none' },
                    })}
                />
            )}
        </Fragment>
    );
};

interface SidebarHeaderProps {
    section: string;
    title?: string;
    partialDisplay?: boolean;
    oneLine?: boolean;
    noPrint?: boolean;
    count?: number;
    icon?: ComponentType<SvgIconProps>;
    children: ReactNode;
}

const SidebarHeader = ({ section, title, partialDisplay = false, oneLine = false, noPrint = false, count, icon: HeaderIcon, children }: SidebarHeaderProps) => {
    const { t } = useTranslation();
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        setCollapsed(!!persistentStorage.getObj<boolean>('collapsed-' + section, false));
    }, [section]);

    const set_collapse = (collapsed: boolean) => {
        persistentStorage.setObj('collapsed-' + section, collapsed);
        setCollapsed(collapsed);
    };

    const toggle_collapse = () => set_collapse(!collapsed);

    const titleText = title === '' ? undefined : t(title || section);

    // TODO: In most cases only need to render children if not collapsed
    return (
        <Box displayPrint={noPrint ? 'none' : ''} title={titleText}>
            <Box
                displayPrint="none"
                display="inline-block"
                style={oneLine ? { float: 'left', verticalAlign: 'middle' } : { float: 'right' }}
                onClick={toggle_collapse}
            >
                <DropDownIcon collapsed={collapsed} />
            </Box>

            {titleText && (
                <Box
                    component="h3"
                    onClick={toggle_collapse}
                    sx={(theme) => ({
                        borderBottom: `1px solid ${theme.palette.border.main}`,
                    })}
                >
                    {HeaderIcon && <HeaderIcon color="primary" />}
                    {titleText}
                    {collapsed && count && ` (${count})`}
                </Box>
            )}
            {(!collapsed || partialDisplay) && (
                <Box
                    display={oneLine ? 'inline' : 'block'}
                    sx={{
                        ...(collapsed &&
                            partialDisplay && {
                                height: 21,
                                overflow: 'hidden',
                            }),
                    }}
                >
                    {children}
                </Box>
            )}
        </Box>
    );
};

function AlbumEntry({ lang, album_song, on_filter_change }: { lang: string; album_song: AlbumSong; on_filter_change: () => void }) {
    const { t } = useTranslation();
    let img = album_song.album.image_path;

    let entry = (
        <Grid container justifyContent="flex-start">
            {img && (
                <Grid size={3}>
                    <Box
                        component="img"
                        alt={t('albums')}
                        src={img}
                        sx={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            pr: '1em',
                        }}
                    />
                </Grid>
            )}
            <Grid size={img ? 9 : 12}>
                <TextDirection lang={lang}>
                    {album_song.album.title} {album_song.track && ` (${t('track')} ${album_song.track})`}
                </TextDirection>
            </Grid>
        </Grid>
    );

    if (album_song.album.purchase_path)
        entry = (
            <Box
                component="a"
                target="_blank"
                rel="noopener noreferrer"
                href={album_song.album.purchase_path}
                sx={(theme) => ({
                    // TODO: Style this
                    marginBottom: 5 / 8,
                    '&:last-child': { marginBottom: 0 },
                    verticalAlign: 'top',
                    textDecoration: 'none',
                    color: theme.palette.primary.main,
                })}
            >
                {entry}
            </Box>
        );
    else
        entry = (
            <Box
                component="a"
                onClick={() => {
                    set_search_text(`album_id=${album_song.album.id}`);
                    on_filter_change();
                }}
                sx={(theme) => ({
                    // TODO: Style this
                    marginBottom: 5 / 8,
                    '&:last-child': { marginBottom: 0 },
                    verticalAlign: 'top',
                    textDecoration: 'none',
                    color: theme.palette.primary.main,
                    ...theme.searchLink,
                })}
            >
                {entry}
            </Box>
        );

    return entry;
}

const AlbumSection = ({ song, on_filter_change }: { song: Song; on_filter_change: () => void }) => {
    const albums = song.albums || [];
    return (
        <SidebarHeader section="albums" count={albums.length} noPrint>
            {albums.map((album_song, idx) => (
                <AlbumEntry key={idx} album_song={album_song} lang={song.lang} on_filter_change={on_filter_change} />
            ))}
        </SidebarHeader>
    );
};

const AudioSectionEntries = ({ items }: { items: AudioSectionItem[] }) => {
    return (
        <Fragment>
            {items.map((v) => (
                <AudioPlayer key={v.file.id ?? `${v.file.type}-${v.song.id}`} {...v} />
            ))}
        </Fragment>
    );
};

const SheetMusicSection = ({ items }: { items: SheetMusicItem[] }) => {
    const { t } = useTranslation();
    return items.map((v) => (
        <Button
            key={v.file.id ?? `${v.file.type}-${v.song.id}`}
            onClick={() => {
                file_feedback('download', v.song.id, v.file.id);
                song_feedback('download', v.song.id);
                try_window_open_download(v.dl_href);
            }}
        >
            {t('download_link')}
        </Button>
    ));
};

const VideoSection = ({ items }: { items: VideoSectionItem[] }) => {
    const { t } = useTranslation();

    // change this watch stat when we have inline watching
    return items.map((v) => (
        <Button
            component="a"
            key={v.file.id ?? `${v.file.type}-${v.song.id}`}
            target="_blank"
            href={`https://youtube.com/watch?v=${v.youtube_id}`}
            rel="noopener noreferrer"
            title={t('youtube_link')}
            onClick={() => {
                file_feedback('watch', v.song.id, v.file.id);
                song_feedback('download', v.song.id);
            }}
        >
            {t('youtube_link')}
        </Button>
    ));
};

export const SongTopInfoSection = ({ song }: { song: Song }) => {
    const { t } = useTranslation();

    return (
        <div id="song-info-top">
            {((song.info || []) as SongInfoEntry[])
                .filter((d) => d.type == 'tempo' || d.type == 'timesignature') // these go in the top section
                .map((d, i) => (
                    <InfoLine key={i} label={t(d.type)}>
                        <TextDirection lang={song.lang}>{d.value}</TextDirection>
                    </InfoLine>
                ))}
        </div>
    );
};

export const FavouriteButton = ({ song }: { song?: Song }) => {
    const { t } = useTranslation();
    const [is_favourite, setIsFavourite] = useState(false);

    useEffect(() => {
        if (song) {
            setIsFavourite(FAVOURITE_DB.get_favourite(song.id));
        }
    }, [song]);

    if (!song) return null;

    const toggle_favourite = () => {
        FAVOURITE_DB.set_favourite(song.id, !FAVOURITE_DB.get_favourite(song.id));
        setIsFavourite(FAVOURITE_DB.get_favourite(song.id));
        song_feedback('favourite', song.id);
    };

    return (
        <ImageButton
            iconColor={is_favourite ? 'secondary' : 'primary'}
            icon={is_favourite ? Icon.SymbolFavourite : Icon.SymbolNotFavourite}
            onClick={toggle_favourite}
        >
            {t('favourite-btn')}
        </ImageButton>
    );
};

const RatingSection = ({ song }: { song: Song }) => {
    const { t } = useTranslation();
    const [my_rating, setMyRating] = useState(0);

    useEffect(() => {
        setMyRating(FAVOURITE_DB.get_rating(song.id));
    }, [song]);

    const rating_update = (_event: SyntheticEvent<Element, Event>, new_rating: number | null) => {
        if (new_rating == null) return;
        const song_id = song.id;
        FAVOURITE_DB.set_rating(song_id, new_rating);
        rating_event([song_id, new_rating], song_id);
        setMyRating(new_rating);
    };

    return (
        <Box displayPrint="none">
            <Box display="inline-block">
                {t('rating')}
                <Rating name="rating" value={my_rating} onChange={rating_update} />
                {song.rating && ` (${song.rating / 10})`}
            </Box>
        </Box>
    );
};
const SongInfoSection = ({ song, on_filter_change }: { song: Song; on_filter_change: () => void }) => {
    const { t, lang_name } = useTranslation();
    const theme = useTheme();

    const info_render = useMemo(() => {
        const entries: ReactNode[] = [];

        (song.sources || [])
            // Don't include random sources that are not proper songbooks
            .filter((source) => source.number || source.abbreviation)
            .forEach((source, idx) => {
                entries.push(
                    <InfoLine key={`s${idx}`} label={t('source')}>
                        <TextDirection lang={song.lang}>
                            <Box
                                component="a"
                                onClick={() => {
                                    toggle_filter_source(source.id, true, true);
                                    on_filter_change();
                                }}
                                sx={{
                                    ...theme.searchLink,
                                }}
                            >
                                {source.name}
                            </Box>{' '}
                            {source.number}
                        </TextDirection>
                    </InfoLine>,
                );
            });

        ((song.info || []) as SongInfoEntry[])
            .filter((d) => d.type != 'tempo' && d.type != 'timesignature')
            .forEach((d, idx) => {
                let value: ReactNode = <TextDirection lang={song.lang}>{d.value}</TextDirection>;

                // In certain types add it as a link to search for this
                if (['words', 'music', 'wordsandmusic', 'translator', 'arrangedby'].includes(d.type)) {
                    value = (
                        <Box
                            component="a"
                            onClick={() => {
                                set_search_text(d.value);
                                on_filter_change();
                            }}
                            sx={{
                                ...theme.searchLink,
                            }}
                        >
                            {value}
                        </Box>
                    );
                }

                entries.push(
                    <InfoLine key={`i${idx}`} label={t(d.type)}>
                        {value}
                    </InfoLine>,
                );
            });

        return entries;
    }, [on_filter_change, song, t, theme]);

    return (
        <SidebarHeader section="song-info" title="details" partialDisplay>
            <div>
                {info_render}
                {song.year && <InfoLine label={t('year_written')}>{song.year}</InfoLine>}
                {song.lang && <InfoLine label={t('language')}>{lang_name(song.lang)}</InfoLine>}
            </div>
        </SidebarHeader>
    );
};

const RelatedSongs = ({ related_songs, lang }: { related_songs: Array<RelatedSong | Song>; lang: string }) => {
    const [display_all, setDisplayAll] = useState(false);
    const { t, lang_name } = useTranslation();

    useEffect(() => {
        setDisplayAll(false);
    }, [related_songs]);

    const songs = related_songs;

    // Mask with a clickbox when we have loads of related songs
    let display_songs = songs;
    if (!display_all && songs.length > 2) {
        display_songs = songs.filter((s) => s.is_original || s.lang == lang);
        if (!display_songs.length) display_songs = [songs[0]];
    }

    // If there is only one item not displayed then don't bother with showing the box
    if (display_songs.length + 1 >= songs.length) display_songs = songs;

    return (
        <SidebarHeader section="translations" count={songs.length} noPrint>
            <List disablePadding>
                {display_songs.map((song, idx) => (
                    <SongListLink withStripe={idx % 2 == 0} key={song.id} song={song} prefix={lang_name(song.lang) + ': '} />
                ))}
                {display_songs.length != songs.length && (
                    <ListItem divider disablePadding>
                        <ListItemButton onClick={() => setDisplayAll(true)}>
                            <ListItemText primary={format_string(t('show_all_related_songs'), songs.length)} />
                        </ListItemButton>
                    </ListItem>
                )}
            </List>
        </SidebarHeader>
    );
};

export const SongInfoSide = ({
    update_item_refs,
    related_songs,
    song,
    on_filter_change,
}: {
    update_item_refs: (name: string, e: HTMLElement | null) => void;
    related_songs?: Array<RelatedSong | Song>;
    song?: Song;
    on_filter_change: () => void;
}) => {
    const [observe_copyright] = useSetting('observe-copyright');

    if (!song) return null;

    const links_done: Record<string, true> = {};
    const sections: {
        'mp3-instrumentals': AudioSectionItem[];
        'mp3-words': AudioSectionItem[];
        'sheet-music': SheetMusicItem[];
        videos: VideoSectionItem[];
    } = {
        'mp3-instrumentals': [],
        'mp3-words': [],
        'sheet-music': [],
        videos: [],
    };

    const change_domain = (path?: string) => (path || '').replace(/^https?:\/\/songs.(yasamkilisesi|worshipleaderapp).com/i, get_host());

    (song.files || []).forEach((d) => {
        // In 99% of cases, replace the file path with whatever our main host
        // is set to to allow using cdn to work around network restrictions.
        // For web (esp http/2) this should also speed up content fetching as
        // not required to negotiate a new connection.
        d.path = change_domain(d.path);

        const data: AudioSectionItem = { file: d, song };
        if (d.type == 'mp3' || d.type == 'promomp3' || d.type == 'instmp3' || d.type == 'backmp3') {
            // Don't display MP3 player on copyright restricted songs to avoid
            // getting blocked from the store
            if (song.copyright_restricted && observe_copyright) return;

            sections[d.type == 'instmp3' ? 'mp3-instrumentals' : 'mp3-words'].push(data);
        } else if (d.type == 'sheetpdf') {
            if (!d.download_path || d.download_path != 'none') {
                const dl_href = change_domain(d.download_path || d.path);

                if (dl_href in links_done) return;
                links_done[dl_href] = true;
                sections['sheet-music'].push({ ...data, dl_href });
            }
        } else if (d.type == 'video') {
            const youtube_id = get_youtube_id(d);
            if (youtube_id) sections.videos.push({ ...data, youtube_id });
        }
    });

    const img = (song.albums || []).map((a) => a.album.image_path).filter((img) => !!img)[0];

    return (
        <Box
            id="song-right"
            ref={(e: HTMLDivElement) => update_item_refs('details', e)}
            sx={(theme) => ({
                padding: 2,
                borderTop: `1px solid ${theme.palette.border.main}`,
                '@media only screen': {
                    backgroundColor: theme.palette.background.default,
                },
                '@media only screen and (min-width: 1000px)': {
                    // Hide border when collapsed
                    borderRight: `1px solid ${theme.palette.border.main}`,
                    marginRight: -0.125,
                    marginTop: -0.125,
                },
            })}
        >
            <TopImage img={img} />

            <Box displayPrint="none">
                <Typography variant="h5">
                    <TextDirection lang={song.lang}>{song.title}</TextDirection>
                </Typography>

                {song.alternative_titles && song.alternative_titles.length > 0 && (
                    <Typography variant="h6">
                        <TextDirection lang={song.lang}>{song.alternative_titles.join(', ')}</TextDirection>
                    </Typography>
                )}
            </Box>

            {related_songs && related_songs.length > 0 && <RelatedSongs lang={song.lang} related_songs={related_songs} />}

            <SongInfoSection song={song} on_filter_change={on_filter_change} />

            <SidebarHeader section="tags" title="tag_str" count={song.tags.length} noPrint>
                <TagsSection tags={song.tags} on_filter_change={on_filter_change} />
            </SidebarHeader>

            <AlbumSection song={song} on_filter_change={on_filter_change} />

            {sections['mp3-words'].length + sections['mp3-instrumentals'].length > 0 && <div ref={(e: HTMLDivElement) => update_item_refs('music', e)} />}

            {sections['mp3-words'].length > 0 && (
                <SidebarHeader section="mp3" noPrint title="listen_words" icon={Icon.SymbolHasMP3} count={sections['mp3-words'].length}>
                    <AudioSectionEntries items={sections['mp3-words']} />
                </SidebarHeader>
            )}

            {sections['mp3-instrumentals'].length > 0 && (
                <SidebarHeader section="mp3" noPrint title="listen_instrumentals" icon={Icon.SymbolHasMP3}>
                    <AudioSectionEntries items={sections['mp3-instrumentals']} />
                </SidebarHeader>
            )}

            {sections['videos'].length > 0 && <div ref={(e: HTMLDivElement) => update_item_refs('videos', e)} />}
            <SidebarHeader section="videos" noPrint oneLine count={sections.videos.length} icon={Icon.Video}>
                <VideoSection items={sections.videos} />
            </SidebarHeader>

            <SidebarHeader noPrint section="sheet-music" title="sheet_music" count={sections['sheet-music'].length} oneLine>
                <SheetMusicSection items={sections['sheet-music']} />
            </SidebarHeader>

            <RatingSection song={song} />
        </Box>
    );
};
