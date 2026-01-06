/*
 * Based on jQuery Chord Transposer plugin v1.0
 * http://codegavin.com/projects/transposer
 *
 * Based on Copyright 2010, Jesse Gavin
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://codegavin.com/license
 */
type KeyScaleType = 'F' | 'S' | 'N';

interface KeyInfo {
    name: string;
    value: number;
    major?: KeyScaleType;
    minor?: KeyScaleType;
    hidden?: number;
    type: KeyScaleType;
    priority?: number;
}

const KEYS: KeyInfo[] = [
    {
        name: 'Ab',
        value: 0,
        major: 'F',
        //minor: 'F',     // not normal
        type: 'F',
    },
    {
        name: 'A',
        value: 1,
        major: 'S',
        minor: 'F', // should not be any non-neutral but if there are
        type: 'N',
    },
    {
        name: 'A#',
        value: 2,
        //major: 'S',     // theoretical only
        //minor: 'S',     // not normal
        type: 'S',
    },
    {
        name: 'Bb',
        value: 2,
        //priority: 1,
        minor: 'F',
        major: 'F',
        type: 'F',
    },
    {
        name: 'B',
        value: 3,
        minor: 'S',
        major: 'S',
        type: 'N',

        // German/Russian music sometimes has H instead of B
    },
    {
        name: 'Hb',
        value: 2,
        hidden: 1,
        minor: 'F',
        major: 'F',
        type: 'F',
    },
    {
        name: 'H',
        value: 3,
        hidden: 1,
        minor: 'S',
        major: 'S',
        type: 'N',
    },
    {
        name: 'C',
        value: 4,
        minor: 'F',
        major: 'F', // should not be any non-neutral but if there are
        type: 'N',
    },
    {
        name: 'C#',
        value: 5,
        minor: 'S',
        //major: 'S',         // not normal
        type: 'S',
    },
    {
        name: 'Db',
        value: 5,
        //minor: 'F',         // theoretical only
        major: 'F',
        type: 'F',
    },
    {
        name: 'D',
        value: 6,
        minor: 'F',
        major: 'S',
        type: 'N',
    },
    {
        name: 'D#',
        value: 7,
        //minor: 'S',         // not normal
        //major: 'S',         // theoretical only
        type: 'S',
    },
    {
        name: 'Eb',
        value: 7,
        //priority: 1,
        minor: 'F',
        major: 'F',
        type: 'F',
    },
    {
        name: 'E',
        value: 8,
        minor: 'S',
        major: 'S',
        type: 'N',
    },
    {
        name: 'F',
        value: 9,
        minor: 'F',
        major: 'F',
        type: 'N',
    },
    {
        name: 'F#',
        value: 10,
        //priority: 1,
        minor: 'S',
        major: 'S',
        type: 'S',
    },
    {
        name: 'Gb',
        value: 10,
        //minor: 'F',         // theoretical only
        //major: 'F',         // not normal
        type: 'F',
    },
    {
        name: 'G',
        value: 11,
        minor: 'F',
        major: 'S',
        type: 'N',
    },
    {
        name: 'G#',
        value: 0,
        minor: 'S',
        //major: 'S',         // theoretical only
        type: 'S',
    },
];
KEYS.sort((a, b) => (a.hidden || 0) - (b.hidden || 0));

export class Transpose {
    /* List the keys and chords that we want to use/display
     * - type: The type of the NOTE/CHORD (Flat/Sharp/Neutral)
     * - major/minor: The type of notes displayed in the major/minor scale of
     *   this key (F/S/N). If missing, not a valid scale - either theoretical
     *   due to double-sharps/flats or 7-8 sharps/flats so pointless.
     * - hidden: don't display in the dropdown
     * - priority: treat this as the note that is preferred if using capo
     *   changes and the key selected is not sharp or flat, for example most
     *   people know Bm rather than A# even though they are the same
     */
    keys = KEYS;

    getKeyByName(name: string): KeyInfo {
        // Convert mixed chars into standard b#
        let normalized = name.replace(/[&\u266D]/g, 'b').replace(/\u266F/g, '#');

        if (normalized.charAt(normalized.length - 1) == 'm') normalized = normalized.substring(0, normalized.length - 1);

        const found = KEYS.find((key) => normalized === key.name);
        if (!found) throw new Error('Could not find key for ' + normalized);

        return found;
    }
    getChordRoot(input: string): string {
        return input.substring(0, input.length > 1 && input.charAt(1).match(/[b#&\u266F\u266D]/) ? 2 : 1);
    }
    getNewKey(oldKey: string, delta: number, targetKey?: KeyInfo, is_minor?: boolean): KeyInfo {
        // ensure keyValue is in 0..11 range
        let keyValue = this.getKeyByName(oldKey).value + delta;
        keyValue -= Math.floor(keyValue / 12) * 12;

        let possibilities = KEYS.filter((note) => note.value === keyValue);
        if (!possibilities.length) {
            throw new Error('Could not find key with value ' + keyValue);
        }
        if (targetKey) {
            const searchType: KeyScaleType | undefined = targetKey[is_minor ? 'minor' : 'major'] || targetKey.type;
            if (searchType) {
                const sameType = possibilities.filter((note) => note.type === searchType);
                if (sameType.length) possibilities = sameType;
            }
        }
        return possibilities[0];
    }
    /*
    getChordType(key) {
        switch (key.charAt(key.length - 1)) {
        case "b":
        case "&":
        case "\u266D":
            return "F";
        case "#":
        case "\u266F":
            return "S";
        default:
            return "N";
        }
    }

    getDelta(oldIndex, newIndex) {
        if (oldIndex > newIndex)
            return 0 - (oldIndex - newIndex);
        else if (oldIndex < newIndex)
            return 0 + (newIndex - oldIndex);
        else
            return 0;
    }
    */
    getNewChord(text: string, delta: number, targetKey?: KeyInfo, is_minor?: boolean): string {
        if (!text) return '';

        if (delta == 0) return text;

        // eslint-disable-next-line no-useless-escape
        return text.replace(/([^\s\/()]+)/g, (oldChord) => {
            // May be invalid chords etc here - just skip ones that are not good
            try {
                let oldChordRoot = this.getChordRoot(oldChord);
                let newChordRoot = this.getNewKey(oldChordRoot, delta, targetKey, is_minor);
                return newChordRoot.name + oldChord.substring(oldChordRoot.length);
            } catch (e) {
                console.log(e);

                return oldChord;
            }
        });
    }
}
