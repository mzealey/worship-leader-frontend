import { Box } from '@mui/material';
import { ComponentType, useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { useTranslation } from '../langpack';
import { clsx, Fragment } from '../preact-helpers';
import { on_resize } from '../resize-watcher';
import { useSetting } from '../settings-store';
import { maybe_convert_solfege } from '../solfege-util';
import { Song } from '../song';
import { format_html_chords, songxml_to_divs } from '../songxml-util';
import { Transpose } from '../transpose';
import type { TransposeDetails } from '../transpose-details';
import { is_rtl, is_vertical_lang } from '../util';
import { ChordPopup } from './chordpopup';

const ZOOM_LEVELS = {
    vsmall: '100%',
    small: '120%',
    medium: '140%',
    large: '180%',
    xlarge: '240%',
    xxlarge: '300%',
};

interface SelectedChord {
    chord: string;
    display_chord: string;
    pageX: number;
    pageY: number;
}

// Define the props that can be passed to SongXMLDisplay from outside
export interface SongXMLDisplayProps {
    song?: Song;
    transpose?: TransposeDetails;
    is_printing?: boolean;
    no_chords?: boolean;
    in_presentation?: boolean;
}

export const SongXMLDisplay: ComponentType<SongXMLDisplayProps> = ({ song, transpose, is_printing, no_chords, in_presentation }) => {
    const { t } = useTranslation();
    const [display_chords] = useSetting('display-chords');
    const [show_fingering] = useSetting('show-fingering');
    const [setting_zoom] = useSetting('song-zoom');
    const [chord_color] = useSetting('chord-color');

    const [selected_chord, setSelectedChord] = useState<SelectedChord | undefined>(undefined);
    const [content, setContent] = useState<string>('');
    const [show_chords, setShowChords] = useState<boolean>(false);
    const [is_rtl_song, setIsRtl] = useState<boolean>(false);

    const songxmlRef = useRef<HTMLDivElement>(null);
    const transRef = useRef(new Transpose());
    const lastChordCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const resizeWatcherRef = useRef<{ unsubscribe: () => void } | null>(null);
    const transWatcherRef = useRef<{ unsubscribe: () => void } | null>(null);

    const display_chord = (chord: string) => {
        // Map # and &/b into sharp/flat symbols
        return maybe_convert_solfege(chord.replace(/[&b]/, '\u266D').replace(/#/, '\u266F'));
    };

    const rerender = useCallback(() => {
        // Width of chords may have changed - re-do the space stuff
        if (songxmlRef.current) {
            format_html_chords(songxmlRef.current);
        }
    }, []);

    const render_chords = useCallback(() => {
        if (!songxmlRef.current) {
            return;
        }

        // Re-transpose the chords
        const transposeObj = transpose || { get_total_delta: () => 0, key: undefined, is_minor: undefined };

        Array.prototype.map.call(songxmlRef.current.querySelectorAll('.chord'), (el) => {
            let chord = transRef.current.getNewChord(el.dataset.chord, transposeObj.get_total_delta(), transposeObj.key, transposeObj.is_minor);
            el.dataset.cur_chord = chord; // for fingering to use

            // Ensure each chord has 1 and 1 only utf8 ltr forcer
            el.children[0].textContent = '\u202D' + display_chord(chord);
        });

        rerender();
    }, [transpose, display_chord, rerender]);

    const refresh_songxml = useCallback(() => {
        if (!song) {
            return;
        }

        // No chords in the songs or we don't want them displayed
        let contentStr = song.songxml;
        let showChordsVal = !!(no_chords ? false : /<chord>/i.test(contentStr) && display_chords);

        if (showChordsVal) {
            // split into multiple chord blocks so each only has 1 chord in it. We
            // do this simalar to the songxml_to_divs() function, but as that is
            // shared with the editor we don't want to split there to make it
            // easier to edit correctly.
            contentStr = contentStr.replace(/(<chord)(>)(.*?)(<\/chord>)/gi, (match, open_tag, open_tag_end, chord_content, close_tag) => {
                return chord_content
                    .replace(/\u202D/g, '') // Hopefully no zwj's in here yet.
                    .replace(/^\s+|\s+$/g, '') // kill spacing
                    .split(/\s+/)
                    .map((chord: string) => `${open_tag} data-chord="${chord}"${open_tag_end}${chord}${close_tag}`)
                    .join('');
            });
        }

        /*
        if( is_copyright(song) ) {
            // Mask copyrighted songs on builds, but not on the web version as we can't
            // get delisted for copyrighted content there.
            content = $('<b>').text( get_translation('copyright_no_show') );
            show_chords = false;
        } else */
        contentStr = songxml_to_divs(contentStr, !showChordsVal, chord_color);

        setContent(contentStr);
        setShowChords(showChordsVal);
        setIsRtl(is_rtl(contentStr.replace(/<[^>]+>/g, '')));
    }, [song, no_chords, display_chords, chord_color]);

    const closeChordPopup = useCallback(() => {
        lastChordCloseRef.current = null;
        setSelectedChord(undefined);
    }, []);

    const startHideChordTimer = useCallback(() => {
        // Set a small timeout in case it is just flipping between the popup and the chord
        if (!lastChordCloseRef.current) {
            lastChordCloseRef.current = setTimeout(closeChordPopup, 200);
        }
    }, [closeChordPopup]);

    const stopHideChordTimer = useCallback(() => {
        if (lastChordCloseRef.current) {
            clearTimeout(lastChordCloseRef.current);
            lastChordCloseRef.current = null;
        }
    }, []);

    const onMouseOver = useCallback(
        (e: MouseEvent<HTMLElement>) => {
            const parent = (e.target as HTMLElement).parentElement;
            if (!parent) return;
            const chord = parent.dataset.cur_chord;
            if (chord) {
                setSelectedChord({ chord, display_chord: display_chord(chord), pageX: e.pageX, pageY: e.pageY });
                stopHideChordTimer();
            }
        },
        [display_chord, stopHideChordTimer],
    );

    const onMouseOut = useCallback(
        (e: MouseEvent<HTMLElement>) => {
            if ((e.target as HTMLElement).classList.contains('chord-inner')) {
                startHideChordTimer();
            }
        },
        [startHideChordTimer],
    );

    // Watch transpose changes
    useEffect(() => {
        if (transpose) {
            const watcher = transpose.subscribe(() => render_chords());
            transWatcherRef.current = watcher;
            return () => {
                watcher.unsubscribe();
            };
        }
        return () => {
            if (transWatcherRef.current) {
                transWatcherRef.current.unsubscribe();
                transWatcherRef.current = null;
            }
        };
    }, [transpose, render_chords]);

    // Setup resize watcher
    useEffect(() => {
        resizeWatcherRef.current = on_resize(() => rerender(), 500);
        return () => {
            if (resizeWatcherRef.current) {
                resizeWatcherRef.current.unsubscribe();
            }
        };
    }, [rerender]);

    // Refresh songxml when song or no_chords changes
    useEffect(() => {
        refresh_songxml();
    }, [refresh_songxml]);

    // Update chords when content changes
    useEffect(() => {
        if (song && songxmlRef.current && content) {
            Array.prototype.map.call(songxmlRef.current.querySelectorAll('.bridge, .chorus, .verse, .prechorus'), (e: Element) => {
                if (e.querySelector('.chord')) {
                    e.classList.add('has-chords');
                }
            });

            if (show_chords) {
                render_chords();
            }
        }
    }, [content, song, show_chords, render_chords]);

    // We don't need to do anything to allow a print at the moment,
    // although perhaps in future we should make page larger and redo the
    // format_html_chords.
    if (is_printing) {
        // was is_printing();
    }

    if (!content) {
        return <b>{t('nolyrics')}</b>;
    }

    return (
        <Fragment>
            {/* Nest divs so that language can provide a font adjustment followed by the zoom setting */}
            <div lang={song?.lang} dir={is_rtl_song ? 'rtl' : 'ltr'}>
                <Box
                    className={clsx(
                        'songxml',
                        in_presentation && 'presentation',
                        in_presentation && (is_vertical_lang(song?.lang) ? 'presentationVertLang' : 'presentationNormalLang'),
                        show_fingering && 'setting-show-fingering',
                        show_chords && 'showchords',

                        // Set the vertical-lr class if mongolian (traditional) and is the song block
                        is_vertical_lang(song?.lang) && 'vertical-lr vertical-lr-scroll',
                    )}
                    sx={(theme) => ({
                        color: theme.palette.text.highlight,
                        '@media only print': {
                            color: '#000',
                        },
                        '&.presentation': {
                            '& .chorus, & .bridge, & .prechorus': { paddingLeft: 0 },
                            textAlign: 'center',
                            fontSize: '20pt',
                            [theme.breakpoints.up('sm')]: { fontSize: '30pt' },
                            [theme.breakpoints.up('md')]: { fontSize: '40pt' },
                        },
                        '&.presentationNormalLang': {
                            // Amount of blank space to add at the bottom of a song when
                            // presenting. We can't use vh units as these change a bit when in
                            // a presentation-iframe
                            paddingBottom: 500, // overscroll
                        },
                        '&.presentationVertLang': {
                            marginRight: 500,
                        },
                    })}
                    style={in_presentation ? {} : { fontSize: setting_zoom ? ZOOM_LEVELS[setting_zoom] : undefined }}
                    ref={(e: any) => (songxmlRef.current = e)}
                    onMouseOver={onMouseOver}
                    onMouseOut={onMouseOut}
                    dangerouslySetInnerHTML={{ __html: content }}
                />
            </div>

            {show_fingering && selected_chord && (
                <ChordPopup selected_chord={selected_chord} onMouseEnter={stopHideChordTimer} onMouseLeave={startHideChordTimer} />
            )}
        </Fragment>
    );
};
