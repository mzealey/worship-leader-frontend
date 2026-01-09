// TODO: Set document.title
import { closestCenter, DndContext, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CircularProgress, IconButton, List } from '@mui/material';
import { useEffect, useState } from 'react';
import { ImageButton } from '../component/basic';
import * as Icon from '../component/icons';
import { SongListLink } from '../component/song-list';
import { TopBar } from '../component/top-bar';
import { DB } from '../db';
import { useTranslation } from '../langpack';
import { Link } from '../preact-helpers';
import { on_set_db_update, SET_DB, type SetEntry } from '../set-db';
import { generate_set_share_link } from '../set-utils';
import { MaybeLoadedSong } from '../song';
import { PageSetShare } from './dialog-set-share';
import { PageSharer } from './sharer';

interface SongListSortableProps {
    id: number;
    index: number;
    song: MaybeLoadedSong;
    set: SetEntry;
    onDeleteItem: () => void;
}

const SongListSortable = ({ id, index, song, set, onDeleteItem }: SongListSortableProps) => {
    const { setNodeRef, transform, attributes, listeners, transition } = useSortable({
        id: id,
    });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    // Don't render if song not loaded
    if ('not_loaded' in song) return null;

    return (
        <div ref={setNodeRef} style={style}>
            <SongListLink withStripe={index % 2 == 1} song={song} set_id={set?.id} noAddToSet>
                {!set.ro && (
                    <IconButton title="Sort" disableRipple style={{ cursor: 'move' }} size="large" {...attributes} {...listeners}>
                        <Icon.Drag />
                    </IconButton>
                )}
                {!set.ro && (
                    <IconButton onClick={onDeleteItem} size="large">
                        <Icon.Delete />
                    </IconButton>
                )}
            </SongListLink>
        </div>
    );
};

interface SetViewSortableProps {
    songs: MaybeLoadedSong[];
    set: SetEntry;
    onSortEnd: (oldIndex: number, newIndex: number) => void;
    onDeleteItem: (song_id: number) => void;
}

const SetViewSortable = ({ songs, set, onSortEnd, onDeleteItem }: SetViewSortableProps) => {
    const [activeSong, setActiveSong] = useState<number | string | null>(null);
    const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor));
    return (
        <DndContext
            sensors={sensors}
            modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
            collisionDetection={closestCenter}
            onDragStart={({ active }) => {
                if (!active) return;
                setActiveSong(active.id);
            }}
            onDragEnd={({ over }) => {
                // TODO: This assumes that a set has a unique set of songs in it
                if (over && activeSong && over.id !== activeSong)
                    onSortEnd(
                        songs.findIndex((s) => s.id === activeSong),
                        songs.findIndex((s) => s.id === over.id),
                    );
                setActiveSong(null);
            }}
            onDragCancel={() => setActiveSong(null)}
        >
            <List disablePadding>
                <SortableContext strategy={verticalListSortingStrategy} items={songs}>
                    {songs.map((song, idx) => (
                        <SongListSortable id={song.id} key={song.id} index={idx} song={song} set={set} onDeleteItem={() => onDeleteItem(song.id)} />
                    ))}
                </SortableContext>
            </List>
        </DndContext>
    );
};

export interface PageSetViewProps {
    set_id: number;
}

export const PageSetView = ({ set_id }: PageSetViewProps) => {
    const { t } = useTranslation();
    const [songs, setSongs] = useState<MaybeLoadedSong[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [set, setSet] = useState<SetEntry | null>(null);
    const [shareSetDialog, setShareSetDialog] = useState<boolean>(false);
    const [shareSetLink, setShareSetLink] = useState<string | null>(null);

    const do_update = async (show_loading: boolean) => {
        const songsList = SET_DB.get_songs(set_id);
        const order: Record<number, number> = {};
        songsList.forEach((s, idx) => {
            order[s.song_id] = idx;
        });

        // Load song details for the set and then sort them according to the requested order
        const song_promise = DB.then((db) =>
            db.get_songs(
                songsList.map((s) => s.song_id),
                true,
                true,
            ),
        ).then((songsResult) => songsResult.sort((a, b) => order[a.id] - order[b.id]));

        if (show_loading) {
            setIsLoading(true);
        }

        const [songsResult, setResult] = await Promise.all([song_promise, SET_DB.get_set(set_id)]);
        setSongs(songsResult);
        setSet(setResult);
        setIsLoading(false);
    };

    useEffect(() => {
        do_update(true);
        const subscription = on_set_db_update.subscribe(() => do_update(false));

        return () => {
            subscription.unsubscribe();
        };
    }, [set_id]);

    const shareSet = () => {
        if (!set) return;
        if (set.live) {
            setShareSetLink(generate_set_share_link(set, true));
        } else {
            setShareSetDialog(true);
        }
    };

    if (!set) {
        return null;
    }

    return (
        <div>
            <TopBar
                before={
                    <IconButton color="inherit" title={t('back')} component={Link} to="/set-list" size="large">
                        <Icon.Back />
                    </IconButton>
                }
                title={t(set.live ? 'set_title_live' : 'set_title') + ': ' + set.name}
            >
                <ImageButton icon={Icon.Share} onClick={shareSet}>
                    {t('sharebtn')}
                </ImageButton>
            </TopBar>

            {shareSetDialog && <PageSetShare set={set} onClose={() => setShareSetDialog(false)} />}
            {shareSetLink && <PageSharer url={shareSetLink} title={t('share_title')} subject={t('share_set_subject')} onClose={() => setShareSetLink(null)} />}

            {isLoading && <CircularProgress />}

            <SetViewSortable
                songs={songs || []}
                set={set}
                onSortEnd={(oldIndex, newIndex) => {
                    // Have to update a new copy of the array...
                    const newSongs = ([] as any[]).concat(songs);
                    newSongs.splice(newIndex, 0, newSongs.splice(oldIndex, 1)[0]);
                    SET_DB.update_set_db_order(
                        set.id,
                        newSongs.map((song) => song.id),
                    );
                    setSongs(newSongs);
                }}
                onDeleteItem={(song_id) => {
                    SET_DB.delete_song_from_set(song_id, set.id);
                    setSongs((songs || []).filter((song) => song.id !== song_id));
                }}
            />
        </div>
    );
};
