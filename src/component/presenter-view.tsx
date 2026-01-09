import { IconButton } from '@mui/material';
import { PresentationCommon, get_presentation, useCast } from '../dual-present';
import { persistentStorage } from '../persistent-storage.es5';
import { clsx, useCallback, useEffect, useRef, useState } from '../preact-helpers';
import { on_resize } from '../resize-watcher';
import { Song } from '../song';
import { songxml_to_divs } from '../songxml-util';
import { is_rtl, is_vertical_lang } from '../util';
import * as Icon from './icons';

const ZOOM_MAX = 5;
const ZOOM_MIN = -2;

type PresentationMessageData = unknown;

interface PresenterViewElementProps {
    song?: Song;
    presentation: PresentationCommon;
}

const PresenterViewElement = ({ song, presentation }: PresenterViewElementProps) => {
    const [zoom, setZoom] = useState<number>(() => persistentStorage.getObj<number>('dual-zoom', 0));
    const [blanked, setBlanked] = useState<boolean>(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const curPosRef = useRef<{ x: number; y: number } | null>(null);
    const scaleRef = useRef<number>(1);
    const castSizeRef = useRef<{ width: number; height: number }>({ width: 1200, height: 800 });

    const sendMsg = useCallback(
        (msg: PresentationMessageData) => {
            presentation.send_msg(msg);
        },
        [presentation],
    );

    const isVertical = () => {
        return song && !!is_vertical_lang(song.lang);
    };

    const sendMessageAllDisplays = useCallback(
        (data: unknown) => {
            if (!iframeRef.current) return;

            iframeRef.current.contentWindow?.postMessage(JSON.stringify(data), '*');
            sendMsg(data);
        },
        [sendMsg],
    );

    const updatePresentationViewSize = useCallback(() => {
        console.log('updating');
        if (!iframeRef.current || !containerRef.current) return;

        const { width, height } = castSizeRef.current;

        const pwidth = containerRef.current.clientWidth;
        const scale = pwidth / width;
        scaleRef.current = scale;

        let containerHeight = scale * height;

        // If vertical then the height of the scroll bar is not factored in,
        // but we want the width calculation based on the amount of horizontal
        // space allocated to this component.
        if (isVertical()) containerHeight += containerRef.current.offsetHeight - containerRef.current.clientHeight;
        containerRef.current.style.height = containerHeight + 'px';

        const scaleStr = `scale(${scale})`;

        // Set iframe dimension according to monitor size
        const attr = isVertical() ? 'height' : 'width';
        iframeRef.current.style[attr] = castSizeRef.current[attr] + 'px';
        ['-webkit-transform', '-moz-transform', '-ms-transform', 'transform'].forEach((prop: string) => {
            iframeRef.current!.style[prop as any] = scaleStr;
        });
    }, [isVertical, sendMsg]);

    const handleZoom = useCallback(
        (delta: number) => {
            let newZoom = zoom + delta;

            // Limit range of zoom
            newZoom = Math.min(newZoom, ZOOM_MAX);
            newZoom = Math.max(newZoom, ZOOM_MIN);
            setZoom(newZoom);

            persistentStorage.setObj('dual-zoom', newZoom);

            sendMessageAllDisplays({ zoom: newZoom });
        },
        [zoom, sendMessageAllDisplays],
    );

    const sendScrollEvent = useCallback(() => {
        if (!containerRef.current) return;
        sendMsg({
            scrollX: containerRef.current.scrollLeft / scaleRef.current,
            scrollY: containerRef.current.scrollTop / scaleRef.current,
        });
    }, [sendMsg]);

    const scrollDelta = useCallback(
        (deltaX: number, deltaY: number) => {
            if (!containerRef.current) return;
            // delta is in terms of the presented display so we scale the messages accordingly
            containerRef.current.scrollTop += deltaY * scaleRef.current;
            containerRef.current.scrollLeft += deltaX * scaleRef.current;
            sendScrollEvent();
        },
        [sendScrollEvent],
    );

    const onMouseUp = () => {
        curPosRef.current = null;
    };

    const onMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!curPosRef.current || !containerRef.current) return;

            containerRef.current.scrollLeft -= e.clientX - curPosRef.current.x;
            containerRef.current.scrollTop -= e.clientY - curPosRef.current.y;
            curPosRef.current.x = e.clientX;
            curPosRef.current.y = e.clientY;
            sendScrollEvent();
        },
        [sendScrollEvent],
    );

    const onMessage = useCallback(
        (event: MessageEvent) => {
            if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;

            const data = JSON.parse(event.data);
            if ('height' in data || 'width' in data) {
                const prop = isVertical() ? 'width' : 'height';
                iframeRef.current.style[prop] = data[prop] + 'px';
                updatePresentationViewSize();
            } else {
                sendMsg(data);
            }
        },
        [sendMsg, isVertical],
    );

    const updateSong = useCallback(() => {
        if (!song) return;

        let html = '';
        if (!blanked) {
            let content = songxml_to_divs(song.songxml, true, undefined);
            html = `<div lang="${song.lang}" dir="${is_rtl(content) ? 'rtl' : 'ltr'}">${content}</div>`;
        }
        sendMessageAllDisplays({
            scrollX: 0,
            scrollY: 0,
            html,
            vertical: isVertical(),
            zoom: zoom,
        });

        // Reset iframe appropriately
        if (containerRef.current) {
            containerRef.current.scrollTop = 0;
            containerRef.current.scrollLeft = 0;
        }
        updatePresentationViewSize();
    }, [song, blanked, zoom, isVertical, sendMessageAllDisplays, updatePresentationViewSize]);

    const setIframe = useCallback(
        (e: HTMLIFrameElement | null) => {
            if (e) {
                e.addEventListener('load', updateSong);
            } else if (iframeRef.current) {
                iframeRef.current.removeEventListener('load', updateSong);
            }
            iframeRef.current = e;
            console.log('iframe', e);
        },
        [updateSong],
    );

    // Component mount
    useEffect(() => {
        window.addEventListener('message', onMessage);
        document.body.addEventListener('mouseup', onMouseUp);
        document.body.addEventListener('mousemove', onMouseMove);

        const subscription = presentation.subject.subscribe((msg: { songxml_request?: boolean; cast_size?: { width: number; height: number } }) => {
            if (msg.songxml_request) {
                updateSong();
            } else if (msg.cast_size) {
                castSizeRef.current = msg.cast_size;
                updatePresentationViewSize();
            }
        });

        updatePresentationViewSize();
        const resizeWatcher = on_resize(() => updatePresentationViewSize(), 500);

        return () => {
            console.log('unmount');
            resizeWatcher.unsubscribe();
            subscription.unsubscribe();
            document.body.removeEventListener('mouseup', onMouseUp);
            document.body.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('message', onMessage);
        };
    }, [onMessage, onMouseUp, onMouseMove, presentation, updateSong, updatePresentationViewSize]);

    // Update song when prop changes
    useEffect(() => {
        updateSong();
    }, [song, updateSong]);

    const scrollUp = () => scrollDelta(0, -200);
    const scrollDown = () => scrollDelta(0, 200);
    const scrollLeft = () => scrollDelta(-200, 0);
    const scrollRight = () => scrollDelta(200, 0);
    const zoomIn = () => handleZoom(1);
    const zoomOut = () => handleZoom(-1);
    const toggleBlank = () => {
        setBlanked((prev) => !prev);
    };
    const exitPresentation = () => {
        presentation.exit_cast_mode();
    };

    // Update song when blanked state changes
    useEffect(() => {
        updateSong();
    }, [blanked]);

    const vertical = isVertical();

    return (
        <div className={clsx('presenter-view', vertical && 'vertical-lang')}>
            <div
                className="iframe-container"
                ref={containerRef}
                onScroll={() => sendScrollEvent()}
                onMouseDown={(e) => (curPosRef.current = { x: e.clientX, y: e.clientY })}
            >
                <iframe src="presentor.html" ref={setIframe} />
            </div>

            <div>
                {vertical ? (
                    <IconButton onClick={scrollLeft}>
                        <Icon.ScrollLeft />
                    </IconButton>
                ) : (
                    <IconButton onClick={scrollUp}>
                        <Icon.ScrollUp />
                    </IconButton>
                )}
                {vertical ? (
                    <IconButton onClick={scrollRight}>
                        <Icon.ScrollRight />
                    </IconButton>
                ) : (
                    <IconButton onClick={scrollDown}>
                        <Icon.ScrollDown />
                    </IconButton>
                )}

                <IconButton onClick={zoomOut} disabled={zoom <= ZOOM_MIN}>
                    <Icon.ZoomOut />
                </IconButton>
                <IconButton onClick={zoomIn} disabled={zoom >= ZOOM_MAX}>
                    <Icon.ZoomIn />
                </IconButton>

                <IconButton onClick={toggleBlank} color={blanked ? 'secondary' : 'inherit'}>
                    {blanked ? <Icon.UnblankScreen /> : <Icon.BlankScreen />}
                </IconButton>

                <IconButton onClick={exitPresentation} color="secondary" style={{ float: 'right' }}>
                    <Icon.ExitPresent />
                </IconButton>
            </div>
        </div>
    );
};

interface PresenterViewProps {
    song: Song;
}

export const PresenterView = ({ song }: PresenterViewProps) => {
    const [presentation, setPresentation] = useState<PresentationCommon | undefined>(undefined);
    const is_active = useCast((state) => state.active);

    useEffect(() => {
        get_presentation().then((pres) => setPresentation(pres));
    }, []);

    if (!presentation || !is_active) return null;

    return <PresenterViewElement song={song} presentation={presentation} />;
};
