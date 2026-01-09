import { Box, CircularProgress, IconButton } from '@mui/material';
import isEqual from 'lodash/isEqual';
import { ABC } from '../abc2svg';
import type { AbcRenderRequest } from '../abc2svg-renderer';
import { file_feedback, song_feedback } from '../feedback';
import { Fragment, useCallback, useEffect, useRef, useState } from '../preact-helpers';
import { on_resize } from '../resize-watcher';
import { Song, SongFile } from '../song';
import type { TransposeDetails } from '../transpose-details';
import { ensure_visible } from '../util';
import * as Icon from './icons';
import { SongXMLDisplay } from './songxml';

interface SheetMusicDisplayProps {
    song?: Song;
    abc_file?: SongFile;
    transpose?: TransposeDetails;
    is_printing?: boolean;
    in_presentation?: boolean;
}

// Given an abc file, render as SVG
const _SheetMusicDisplay = ({ song, abc_file, transpose, is_printing, in_presentation }: SheetMusicDisplayProps) => {
    const [playing, setPlaying] = useState<boolean>(false);
    const [instrumentLoading, setInstrumentLoading] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [needsSongxml, setNeedsSongxml] = useState<boolean>(false);

    const sheetMusicRef = useRef<HTMLDivElement>(null);
    const longpressTimerRef = useRef<number | null>(null);
    const longpressTimerRanRef = useRef<boolean>(false);
    const lastRequestRef = useRef<AbcRenderRequest | null>(null);
    const abcRef = useRef<ABC | null>(null);

    const abcSetNote = (noteId: string, isStart: boolean) => {
        if (!sheetMusicRef.current) return;

        const note = sheetMusicRef.current.querySelector(`svg #i${noteId}`) as HTMLElement;
        if (note) {
            note.style.fillOpacity = isStart ? '0.4' : '0';
            if (isStart) {
                let parent = note.parentElement;
                while (parent && parent.tagName !== 'svg') parent = parent.parentElement;

                if (parent) ensure_visible(parent);
            }
        }
    };

    const clearLongpressTimer = () => {
        if (longpressTimerRef.current) {
            clearTimeout(longpressTimerRef.current);
            longpressTimerRef.current = null;
        }
    };

    const togglePlaying = (newPlaying: boolean) => {
        console.log('togglePlaying', newPlaying, abcRef.current);
        abcRef.current?.toggle_playing(newPlaying);
        setPlaying(newPlaying);
    };

    const longPress = () => {
        clearLongpressTimer();
        togglePlaying(false);
        abcRef.current?.reset_play_position();
        togglePlaying(true);
    };

    const onTouchStart = () => {
        longpressTimerRanRef.current = false;
        if (!longpressTimerRef.current) {
            longpressTimerRef.current = window.setTimeout(() => {
                longpressTimerRanRef.current = true;
                longPress();
            }, 1000);
        }
    };

    const onTouchEnd = (e: React.TouchEvent) => {
        clearLongpressTimer();
        if (longpressTimerRanRef.current) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    const onContextMenu = (e: React.MouseEvent) => {
        longPress();
        e.preventDefault();
        e.stopPropagation();
    };

    const onClick = () => {
        togglePlaying(!playing);
    };

    const rerender = useCallback(() => {
        if (!sheetMusicRef.current || !abc_file) return;

        const abc = abc_file.abc as string;

        let requestedWidth = 0;
        if (is_printing) requestedWidth = 1000;

        const renderParams: AbcRenderRequest = {
            abc,
            width: requestedWidth || sheetMusicRef.current.offsetWidth * 1.25 || window.innerWidth,
        };

        if (transpose) renderParams.delta = transpose.get_total_delta();

        // Avoid lots of unnecessary work
        if (isEqual(lastRequestRef.current, renderParams)) return;
        lastRequestRef.current = renderParams;

        setIsLoading(true);
        abcRef
            .current!.abc_render(renderParams)
            .finally(() => setIsLoading(false))
            .then((render) => {
                console.log('abc_render', render);
                abcRef.current!.set_audio(render.audio);

                if (!sheetMusicRef.current) return;

                const start = Date.now();
                sheetMusicRef.current.innerHTML = render.svg;
                if (DEBUG) console.log('rendering svg took', Date.now() - start, 'ms');

                // Restore the songxml after if we don't have any words (eg for translated ones)
                if (!/\n[wW]:/.test(abc)) setNeedsSongxml(true);

                if (is_printing) {
                    // Trigger print dialog or whatever mechanism is used
                }
            });
    }, [abc_file, transpose, is_printing]);

    const watchTranspose = useCallback(() => {
        if (transpose) {
            return transpose.subscribe(() => rerender());
        }
        return null;
    }, [transpose, rerender]);

    // Initialize ABC
    useEffect(() => {
        abcRef.current = new ABC(
            (noteId, isStart) => abcSetNote(noteId, isStart),
            (loading) => setInstrumentLoading(loading),
        );
    }, []);

    // Song changed
    useEffect(() => {
        if (!song || !abc_file) return;

        togglePlaying(false);
        song_feedback('sheet_view', song.id);
        file_feedback('sheet_view', song.id, abc_file.id);
        rerender();
    }, [song, abc_file]);

    // Watch transpose changes
    useEffect(() => {
        const subscription = watchTranspose();
        return () => {
            if (subscription) {
                subscription.unsubscribe();
            }
        };
    }, [watchTranspose]);

    // Rerender on transpose or printing changes
    useEffect(() => {
        rerender();
    }, [transpose, is_printing]);

    // Resize watcher
    useEffect(() => {
        const resizeWatcher = on_resize(() => rerender(), 500);
        return () => {
            resizeWatcher.unsubscribe();
        };
    }, [rerender]);

    return (
        <Fragment>
            {(isLoading || instrumentLoading) && (
                <Box displayPrint="none" display="flex" justifyContent="center" p={5}>
                    <CircularProgress />
                </Box>
            )}

            {!in_presentation && (
                <Box displayPrint="none">
                    {!isLoading && (
                        <IconButton onClick={onClick} color="primary">
                            {playing ? <Icon.Pause /> : <Icon.Play />}
                        </IconButton>
                    )}
                </Box>
            )}

            <Box
                ref={sheetMusicRef}
                onClick={onClick}
                onContextMenu={onContextMenu}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
                sx={(theme) => ({
                    '& svg': {
                        marginBottom: 15 / 8,
                        color: theme.score.color,
                        '& .overlay': {
                            fill: theme.score.highlight,
                            fillOpacity: 0,
                            '@media only print': { display: 'none' },
                        },
                    },
                })}
            />

            {needsSongxml && <SongXMLDisplay song={song} no_chords={true} />}
        </Fragment>
    );
};

export const SheetMusicDisplay = _SheetMusicDisplay;
