import { describe, expect, it } from 'vitest';
import { Transpose } from '../src/transpose';

describe('common function', function () {
    const t = new Transpose();

    describe('getNewChord', function () {
        it('basic transpose', function () {
            expect(t.getNewChord('A', 2)).toBe('B');
        });
        it('basic wrap transpose', function () {
            expect(t.getNewChord('F', 6)).toBe('B');
        });
        it('high transpose', function () {
            expect(t.getNewChord('A', 26)).toBe('B');
        });
        it('high wrap transpose', function () {
            expect(t.getNewChord('F', 30)).toBe('B');
        });
        it('basic negative transpose', function () {
            expect(t.getNewChord('G', -5)).toBe('D');
        });
        it('basic negative wrap transpose', function () {
            expect(t.getNewChord('A#', -5)).toBe('F');
        });
        it('high negative transpose', function () {
            expect(t.getNewChord('G', -29)).toBe('D');
        });
        it('high negative wrap transpose', function () {
            expect(t.getNewChord('A#', -29)).toBe('F');
        });
        it('Complex transpose with /', function () {
            expect(t.getNewChord('G#sus/D7', 2)).toBe('A#sus/E7');
        });
        it('Complex transpose with multiple chords', function () {
            expect(t.getNewChord('A B\tC/D', 2)).toBe('B C#\tD/E');
        });
        it('Brackets', function () {
            expect(t.getNewChord('(Gm)', 2)).toBe('(Am)');
        });

        it('With target key', function () {
            expect(t.getNewChord('G#', 2, t.getKeyByName('Eb'))).toBe('Bb');
            expect(t.getNewChord('G#', 2, t.getKeyByName('F#'))).toBe('A#');
        });
        it('With minor target key', function () {
            expect(t.getNewChord('G#', 2, t.getKeyByName('G'))).toBe('A#');
            expect(t.getNewChord('G#', 2, t.getKeyByName('G'), true)).toBe('Bb');
        });
        it('With unusual key', function () {
            expect(t.getNewChord('G#', 2, t.getKeyByName('Gb'))).toBe('Bb');
            expect(t.getNewChord('G#', 2, t.getKeyByName('Gb'), true)).toBe('Bb');
        });
    });

    describe('getKeyByName', function () {
        it('finds keys by exact name', function () {
            expect(t.getKeyByName('C').value).toBe(4);
            expect(t.getKeyByName('D').value).toBe(6);
            expect(t.getKeyByName('F#').value).toBe(10);
        });

        it('converts special characters to standard notation', function () {
            expect(t.getKeyByName('D&').value).toBe(5); // & -> b (Db)
            expect(t.getKeyByName('F♯').value).toBe(10); // ♯ -> # (F#)
            // Note: C♭ would be B, but there's no Cb in the keys array
            expect(() => t.getKeyByName('C♭')).toThrow('Could not find key for Cb');
        });

        it('handles minor key notation', function () {
            expect(t.getKeyByName('Am').value).toBe(1);
            expect(t.getKeyByName('Dm').value).toBe(6);
            expect(t.getKeyByName('Bbm').value).toBe(2);
        });

        it('throws error for invalid key names', function () {
            expect(() => t.getKeyByName('X')).toThrow('Could not find key for X');
            expect(() => t.getKeyByName('Zb')).toThrow('Could not find key for Zb');
        });

        it('handles German notation (H)', function () {
            expect(t.getKeyByName('H').value).toBe(3); // H = B
            expect(t.getKeyByName('Hb').value).toBe(2); // Hb = Bb
        });
    });

    describe('getChordRoot', function () {
        it('extracts single letter roots', function () {
            expect(t.getChordRoot('C')).toBe('C');
            expect(t.getChordRoot('D')).toBe('D');
            expect(t.getChordRoot('Cmaj7')).toBe('C');
        });

        it('extracts sharp roots', function () {
            expect(t.getChordRoot('C#')).toBe('C#');
            expect(t.getChordRoot('F#m')).toBe('F#');
            expect(t.getChordRoot('G#sus4')).toBe('G#');
        });

        it('extracts flat roots', function () {
            expect(t.getChordRoot('Bb')).toBe('Bb');
            expect(t.getChordRoot('Ebmaj7')).toBe('Eb');
            expect(t.getChordRoot('Ab')).toBe('Ab');
        });

        it('handles special flat characters', function () {
            expect(t.getChordRoot('D&m')).toBe('D&'); // & symbol
            expect(t.getChordRoot('C♭')).toBe('C♭'); // unicode flat
        });

        it('handles unicode sharp character', function () {
            expect(t.getChordRoot('F♯maj7')).toBe('F♯'); // unicode sharp
        });

        it('handles empty or short input', function () {
            expect(t.getChordRoot('')).toBe('');
            expect(t.getChordRoot('C')).toBe('C');
        });
    });

    describe('getNewKey', function () {
        it('transposes keys correctly with delta', function () {
            let result = t.getNewKey('C', 2);
            expect(result.name).toBe('D');
            expect(result.value).toBe(6);
        });

        it('wraps around octave correctly', function () {
            let result = t.getNewKey('A', 3); // A + 3 = C
            expect(result.name).toBe('C');
            expect(result.value).toBe(4);
        });

        it('handles negative deltas', function () {
            let result = t.getNewKey('D', -2); // D - 2 = C
            expect(result.name).toBe('C');
            expect(result.value).toBe(4);
        });

        it('handles large positive deltas', function () {
            let result = t.getNewKey('C', 14); // C + 14 = D (wraps)
            expect(result.name).toBe('D');
            expect(result.value).toBe(6);
        });

        it('handles large negative deltas', function () {
            let result = t.getNewKey('D', -14); // D - 14 = C (wraps)
            expect(result.name).toBe('C');
            expect(result.value).toBe(4);
        });

        it('prefers target key type when provided', function () {
            let targetKey = t.getKeyByName('Eb'); // Flat key
            let result = t.getNewKey('G#', 2, targetKey); // G# + 2 could be Bb or A#
            expect(result.name).toBe('Bb'); // Should prefer flat
        });

        it('considers minor scale preferences', function () {
            let targetKey = t.getKeyByName('G');
            let result1 = t.getNewKey('G#', 2, targetKey, false); // major scale
            let result2 = t.getNewKey('G#', 2, targetKey, true); // minor scale
            // Results may differ based on the target key's major/minor preferences
            expect(result1.value).toBe(2); // Both should be value 2 (Bb/A#)
            expect(result2.value).toBe(2);
        });
    });

    describe('keys array structure', function () {
        it('contains all expected keys', function () {
            let keyNames = t.keys.map((k) => k.name);
            expect(keyNames).toContain('C');
            expect(keyNames).toContain('C#');
            expect(keyNames).toContain('Db');
            expect(keyNames).toContain('D');
            expect(keyNames).toContain('D#');
            expect(keyNames).toContain('Eb');
            expect(keyNames).toContain('E');
            expect(keyNames).toContain('F');
            expect(keyNames).toContain('F#');
            expect(keyNames).toContain('Gb');
            expect(keyNames).toContain('G');
            expect(keyNames).toContain('G#');
            expect(keyNames).toContain('Ab');
            expect(keyNames).toContain('A');
            expect(keyNames).toContain('A#');
            expect(keyNames).toContain('Bb');
            expect(keyNames).toContain('B');
        });

        it('has correct value mappings', function () {
            expect(t.keys.find((k) => k.name === 'C')?.value).toBe(4);
            expect(t.keys.find((k) => k.name === 'C#')?.value).toBe(5);
            expect(t.keys.find((k) => k.name === 'Db')?.value).toBe(5);
        });

        it('includes German notation keys', function () {
            let keyNames = t.keys.map((k) => k.name);
            expect(keyNames).toContain('H'); // German B
            expect(keyNames).toContain('Hb'); // German Bb
        });
    });
});
