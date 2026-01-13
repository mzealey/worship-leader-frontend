import { Box, Button, IconButton, useTheme } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { ABC } from '../abc2svg';
import { Chord } from '../chord';
import { fetch_json } from '../util';
import * as Icon from './icons';

type ChordFingerings = string[];
type ChordDictionary = Record<string, ChordFingerings>;

let _chord_data: Promise<ChordDictionary> | undefined;

interface ChordPopupProps {
    selected_chord: {
        chord: string;
        display_chord: string;
        pageX: number;
        pageY: number;
    };
    [key: string]: unknown;
}

export const ChordPopup = ({ selected_chord, ...props }: ChordPopupProps) => {
    const theme = useTheme();
    const [displayIdx, setDisplayIdx] = useState(0);
    const [chordData, setChordData] = useState<ChordDictionary | undefined>(undefined);
    const abcRef = useRef<ABC | null>(null);
    const canvasRef = useRef<HTMLDivElement | null>(null);
    const fingeringRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        if (!_chord_data) {
            _chord_data = fetch_json<ChordDictionary>('chords.json');
        }
        _chord_data.then((chord_data) => setChordData(chord_data));

        return () => {
            if (abcRef.current) {
                abcRef.current.toggle_playing(false);
            }
        };
    }, []);

    useEffect(() => {
        if (canvasRef.current && fingeringRef.current) {
            canvasRef.current.innerHTML = '';
            const size = 5;
            const diagram = new Chord('', fingeringRef.current).getDiagram(size, {
                color: theme.palette.text.highlight,
            });
            canvasRef.current.appendChild(diagram);
        }
    }, [displayIdx, chordData, theme]);

    const play_chord = () => {
        if (!fingeringRef.current) return;

        // Fingerings for the standard guitar tuning in ABC internal notation
        const notes = [52, 57, 62, 67, 71, 76];

        // Generate the audio for the fingering
        const play_notes = fingeringRef.current
            .split(/\s+/)
            .map((finger, idx) => notes[idx] + parseInt(finger))
            .filter((note) => !isNaN(note));

        if (abcRef.current) {
            abcRef.current.toggle_playing(false);
        } else {
            abcRef.current = new ABC();
        }

        const note_length = 0.3;

        abcRef.current.set_audio(
            // Play notes individually and then all together at the end
            play_notes
                .map((note, idx) => new window.Float32Array([idx, note_length * idx, 0, note, note_length, 1, 0]))
                .concat(play_notes.map((note, idx) => new window.Float32Array([10 + idx, note_length * play_notes.length, 0, note, note_length * 3, 1, 0]))),
        );
        abcRef.current.toggle_playing(true);
    };

    const prev_chord = () => setDisplayIdx(displayIdx - 1);
    const next_chord = () => setDisplayIdx(displayIdx + 1);

    if (!chordData) return null;

    const chord = selected_chord.chord
        .toLowerCase()
        .replace(/h/g, 'b')
        .replace(/&/g, 'b') // flats
        .replace(/min?/, 'm') // Eg Amin or Ami are the same as Am
        .replace(/[()\s.]/g, ''); // kill useless chars too

    const fingerings = chordData[chord];
    if (!fingerings || fingerings.length === 0) {
        console.log('could not find fingering for chord "' + chord + '"');
        return null;
    }

    let normalizedIdx = displayIdx;
    if (normalizedIdx < 0) {
        normalizedIdx += fingerings.length;
    } else if (normalizedIdx >= fingerings.length) {
        normalizedIdx = normalizedIdx % fingerings.length;
    }

    fingeringRef.current = fingerings[normalizedIdx];

    return (
        <Box
            {...props}
            sx={(theme) => ({
                border: `1px solid ${theme.palette.border.main}`,
                zIndex: theme.zIndex.tooltip,
                position: 'absolute',
                backgroundColor: theme.palette.background.paper,
                textAlign: 'center',
                transform: 'translateX(-50%)',
                '@media only print': { display: 'none' },
            })}
            style={{ top: selected_chord.pageY + 2, left: selected_chord.pageX }}
        >
            <Box component="h4" sx={{ margin: '5px 0 0' }}>
                {selected_chord.display_chord}
            </Box>
            <div ref={canvasRef} onClick={play_chord} />

            {fingerings.length > 1 && (
                <Box display="flex" alignItems="center">
                    <IconButton onClick={prev_chord}>
                        <Icon.Prev />
                    </IconButton>
                    {normalizedIdx + 1}/{fingerings.length}
                    <IconButton onClick={next_chord}>
                        <Icon.Next />
                    </IconButton>
                </Box>
            )}

            <Button
                fullWidth
                color="primary"
                onClick={play_chord}
                sx={(theme) => ({
                    borderTop: `1px solid ${theme.palette.border.main}`,
                })}
            >
                <Icon.Play />
            </Button>
        </Box>
    );
};
