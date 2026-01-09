import { Box, IconButton, alpha as fade } from '@mui/material';
import { create } from 'zustand';
import { file_feedback } from '../feedback';
import { get_downloaded_file, is_local_url_allowed } from '../file-download-utils';
import { usePagePadding } from '../page-padding';
import { PageSharer } from '../page/sharer';
import { Fragment, clsx, useEffect, useRef, useState } from '../preact-helpers';
import { Song } from '../song';
import { MediaFile } from '../util';
import { DownloadButton } from './file-download';
import * as Icon from './icons';

// Extended HTMLAudioElement with custom property for tracking start position
interface ExtendedHTMLAudioElement extends HTMLAudioElement {
    _start_position?: number;
}

interface ActivePlayer {
    activeFileId: number | undefined;
    setActiveFileId: (fileId?: number) => void;
}
const useActivePlayer = create<ActivePlayer>((set) => ({
    activeFileId: undefined,
    setActiveFileId: (fileId?: number) => set({ activeFileId: fileId }),
}));

const audio_player_track_height = 6;
const audio_player_drag_circle_radius = 10;

// Correct way for reading the file locally (when the file://
// url doesnt work as per wkwebview, although not sure if this
// reads it all into memory first or somesuch..
/*
r = new FileReader();
r.onloadend = function() {
    url = window.URL.createObjectURL( new Blob([new Uint8Array(this.result)], { type: "audio/mp3" }) );
    mejs.setSrc( url );
};
r.readAsArrayBuffer(file);
*/

// Check if browser supports audio playback
const testAudio = document.createElement('audio');
const supportsAudio = typeof testAudio.play === 'function' && typeof testAudio.pause === 'function';

interface AudioFile extends MediaFile {
    id: number;
    duration?: number;
    download_path?: string;
}

interface AudioPlayerProps {
    song: Song;
    file: AudioFile;
}

const parseTime = (seconds: number) => {
    if (isNaN(seconds)) seconds = 0;

    let mins = Math.floor((seconds % 3600) / 60)
        .toFixed(0)
        .toString();
    let secs = Math.floor(seconds % 60)
        .toFixed(0)
        .toString();
    if (parseInt(secs) < 10) secs = `0${secs}`;
    return `${mins}:${secs}`;
};

export const AudioPlayer = ({ song, file }: AudioPlayerProps) => {
    const bottom = usePagePadding((state) => state.bottom);

    const activePlayer = useActivePlayer();
    const elemRef = useRef<HTMLDivElement>(null);

    const [progress, setProgress] = useState<number>(0);
    const [duration, setDuration] = useState<number>(0);
    const [buffering, setBuffering] = useState<number>(0);
    const [playing, setPlaying] = useState<boolean>(false);
    const [shareLink, setShareLink] = useState<string | boolean>(false);

    const isActivePlayer = activePlayer.activeFileId === file.id;

    const audioRef = useRef<ExtendedHTMLAudioElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);

    const finalDuration = duration || file?.duration || 0;

    const largestLoadTimestamp = () => {
        if (!audioRef.current) return 0;
        const b = audioRef.current.buffered;
        let max = 0;
        // Don't bother about the range intracies just get the furthest along that was buffered
        for (let i = 0; i < b.length; i++) {
            if (max < b.end(i)) max = b.end(i);
        }
        return max;
    };

    const downFileKey = () => {
        return song.id + '-' + file.id;
    };

    const maybeShowBuffering = () => {
        if (playing && audioRef.current && largestLoadTimestamp() <= audioRef.current.currentTime) setBuffering(1);
    };

    const progressUpdate = () => {
        const audioElem = audioRef.current;
        if (!audioElem) return;

        if (audioElem.readyState && audioElem._start_position) {
            audioElem.currentTime = audioElem._start_position;
            delete audioElem._start_position;
        }

        setDuration(audioElem.duration || finalDuration);
    };

    const trackTouch = (e: React.MouseEvent | React.TouchEvent) => {
        const isTouch = /^touch/.test(e.type);
        if ((e as React.MouseEvent).buttons || isTouch) {
            const clickPos = (isTouch ? (e as React.TouchEvent).touches[0] : (e as React.MouseEvent)).pageX - trackRef.current!.offsetLeft;
            let perc = clickPos / trackRef.current!.offsetWidth;
            if (perc < 0) perc = 0;
            else if (perc > 1) perc = 1;

            const newProgress = perc * finalDuration;
            setProgress(newProgress);
            const audio = audioRef.current;
            if (audio) {
                if (audio.readyState) audio.currentTime = newProgress;
                else audio._start_position = newProgress;
            }
            maybeShowBuffering();
        }
        e.preventDefault();
    };

    const _togglePlay = (newPlaying: boolean) => {
        setPlaying(newPlaying);

        try {
            if (newPlaying) audioRef.current!.play();
            else audioRef.current!.pause();
        } catch (e) {
            // sometimes ie10 server edition throws a 'Not implemented' issue here
        }
    };

    const togglePlay = (newPlaying: boolean = !playing, sendFeedback: boolean = true) => {
        _togglePlay(newPlaying ?? !playing);

        if (sendFeedback) file_feedback(newPlaying ? 'play' : 'pause', song.id, file.id);

        if (newPlaying)
            // Pause all other audio elements if need be
            activePlayer.setActiveFileId(file.id);
        else if (isActivePlayer)
            // Hide player after X ms of being paused
            setTimeout(() => {
                if (isActivePlayer && !playing) activePlayer.setActiveFileId(undefined);
            }, 2000);
    };

    // Pause players when they become inactive - because activeFileId changed
    useEffect(() => {
        if (!isActivePlayer) togglePlay(false);
    }, [isActivePlayer]);

    const setSrc = (src: string) => {
        try {
            audioRef.current!.src = src;
        } catch (e) {
            // ie10 with sound disabled
            return;
        }

        // Reset everything in the player
        togglePlay(false, false);
        setProgress(0);
        setDuration(0);
        setBuffering(0);
    };

    useEffect(() => {
        (async () => {
            if (!audioRef.current) return;

            const local_allowed = await is_local_url_allowed();
            const downloaded = get_downloaded_file(downFileKey());
            setSrc(local_allowed && downloaded?.local_url ? downloaded.local_url : file.path || '');
        })();
    }, [audioRef.current, file.id]);

    const handleShare = () => {
        file_feedback('share', song.id, file.id);
        setShareLink(`song.html?song_id=${song.id}`);
    };

    const closeSharer = () => setShareLink(false);

    const onTimeUpdate = () => {
        if (!audioRef.current) return;

        setBuffering(0);
        setProgress(audioRef.current.currentTime);
        setDuration(audioRef.current.duration);

        if (progress && duration && progress >= duration) {
            togglePlay(false, false);
            setProgress(0);
        }
    };

    useEffect(() => {
        // When component is deleted it is no longer possible for it to be active
        return () => {
            if (activePlayer.activeFileId === file.id) activePlayer.setActiveFileId(undefined);
        };
    }, []);

    if (!supportsAudio) return null;

    return (
        <Box
            ref={elemRef}
            className={clsx(isActivePlayer && 'sticky')}
            sx={(theme) => ({
                padding: 0.25,
                display: 'flex',
                alignItems: 'center',
                lineHeight: 1,
                fontSize: 12,
                color: theme.palette.text.primary,
                '&.sticky': {
                    [theme.breakpoints.down('sm')]: {
                        position: 'fixed',
                        left: 0,
                        right: 0,
                        zIndex: theme.zIndex.appBar + 1,
                        backgroundColor: theme.palette.background.default,
                        borderTop: `1px solid ${theme.palette.border.main}`,
                    },
                },
                '& .text': {
                    marginLeft: 7 / 8,
                    marginRight: 7 / 8,
                },
                '& .playBtn': {
                    backgroundColor: theme.palette.primary.main,
                    color: theme.palette.primary.contrastText,
                    transition: 'background-color 0.3s',
                    '&:hover': {
                        backgroundColor: fade(theme.palette.primary.main, 0.5),
                    },
                },
                '& .playBtn.playing': {
                    backgroundColor: fade(theme.palette.primary.main, 0.5),
                },
                '& .trackContainer': {
                    borderRadius: 0.25,
                    cursor: 'pointer',
                    flexGrow: 1,
                    position: 'relative',
                    marginLeft: `${audio_player_drag_circle_radius - 2}px`,
                    marginRight: `${audio_player_drag_circle_radius - 2}px`,
                    paddingTop: theme.typography.pxToRem(18),
                    paddingBottom: theme.typography.pxToRem(18 + audio_player_track_height),
                },
                '& .track': {
                    height: `${audio_player_track_height}px`,
                    position: 'absolute',
                    left: 0,
                    borderRadius: 0.25,
                    cursor: 'pointer',
                },
                '& .trackBg': {
                    backgroundColor: 'rgba(223, 223, 223, 0.3)',
                    width: '100%',
                },
                '& .trackBuffering': {
                    animation: 'buffering-stripes 2s linear infinite',
                    background:
                        'linear-gradient(-45deg, rgba(200, 200, 200, 1) 25%, transparent 25%, transparent 50%, rgba(200, 200, 200, 1) 50%, rgba(200, 200, 200, 1) 75%, transparent 75%, transparent)',
                    backgroundSize: '15px 15px',
                },
                '& .trackBuffered': {
                    backgroundColor: 'rgba(223, 223, 223, 0.3)',
                },
                '& .trackIndicator': {
                    backgroundColor: theme.palette.audio.track,
                    '&:after': {
                        backgroundColor: theme.palette.audio.track,
                        display: 'block',
                        position: 'absolute',
                        content: "''",
                        right: `${-audio_player_drag_circle_radius}px`,
                        top: `${-(audio_player_drag_circle_radius - audio_player_track_height / 2)}px`,
                        width: `${audio_player_drag_circle_radius * 2}px`,
                        height: `${audio_player_drag_circle_radius * 2}px`,
                        borderRadius: `${audio_player_drag_circle_radius}px`,
                    },
                },
            })}
            style={isActivePlayer ? { bottom } : {}}
        >
            <audio preload="none" ref={audioRef} onProgress={progressUpdate} onCanPlayThrough={progressUpdate} onTimeUpdate={onTimeUpdate}></audio>
            <IconButton size="small" className={clsx('playBtn', playing && 'playing')} onClick={() => togglePlay()}>
                {playing ? <Icon.Pause /> : <Icon.Play />}
            </IconButton>
            <div className="text">{parseTime(progress)}</div>
            <div className="trackContainer" ref={trackRef} onMouseDown={trackTouch} onMouseMove={trackTouch} onTouchStart={trackTouch} onTouchMove={trackTouch}>
                <div className={clsx('track', 'trackBg', buffering && 'trackBuffering')}></div>
                <div
                    className={clsx('track', 'trackBuffered')}
                    style={audioRef.current && finalDuration ? { width: ((largestLoadTimestamp() / finalDuration) * 100).toFixed(2) + '%' } : {}}
                ></div>
                <div
                    className={clsx('track', 'trackIndicator')}
                    style={finalDuration ? { width: (((progress || 0) / (finalDuration as number)) * 100).toFixed(2) + '%' } : {}}
                ></div>
            </div>
            <div className="text">{parseTime(finalDuration)}</div>
            {(!file.download_path || file.download_path != 'none') && (
                <Fragment>
                    <IconButton size="small" color="primary" title="Share" onClick={handleShare}>
                        <Icon.Share />
                    </IconButton>
                    {shareLink && <PageSharer url={shareLink as string} file={file.path} title="Share" subject="Share" onClose={closeSharer} />}
                    <DownloadButton song={song} file={file} onDownload={setSrc} down_file_key={downFileKey()} />
                </Fragment>
            )}
        </Box>
    );
};

/*
function mp3_no_internet() {
    //$('#songinfo .mp3nonetwork').popup('open');
    // XXX Can't find a way to make this work properly...
};
file_entries.find('audio')
    .on('waiting', function() {
        console.log('waiting');
        // when play is first clicked, do a 2 second timeout & display
        // no network if at the end we get navigator.onLine as false.
        mp3waiting = setTimeout(function(){
            if( ! navigator.onLine )
                mp3_no_internet();
        }, 2000);
    })
    .on('error loadstart playing suspended', function(e) {
        let obj = e.currentTarget;
        //console.log(e.type + ' net state ' + obj.networkState + ' no source ' + obj.NETWORK_NO_SOURCE);

        // Chrome does this on page load
        if( !mp3waiting && e.type == 'loadstart' )
            return;

        if( mp3waiting ) {
            clearTimeout(mp3waiting);
            mp3waiting = null;
        }

        // some browsers (andrdoid) throw a playing even when there is
        // no network connectivity however the network state below is
        // set correctly to no source.
        if(obj.networkState == 3)   // android 2 does this (but NETWORK_NO_SOURCE is set to 4)
            mp3_no_internet();
        if( ! navigator.onLine )    // android 3/4?
            mp3_no_internet();
    });
    */
