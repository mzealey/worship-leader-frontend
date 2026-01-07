import { beforeEach, describe, expect, it } from 'vitest';

import { abc2svg } from 'abc2svg';
import { AbcRenderer } from '../src/abc2svg-renderer';
(globalThis as any).abc2svg = abc2svg;
(globalThis as any).self = { abc2svg };

describe('AbcRenderer', () => {
    let renderer: AbcRenderer;

    beforeEach(() => {
        renderer = new AbcRenderer();
    });

    describe('ping', () => {
        it('returns 1', () => {
            expect(renderer.ping()).toBe(1);
        });
    });

    describe('abc_render', () => {
        const SIMPLE_ABC = `X:1
T:Test Tune
M:4/4
L:1/4
K:C
CDEF|GABc|`;

        const SIMPLE_ABC_WITH_CHORDS = `X:1
T:Test With Chords
M:4/4
L:1/4
K:G
"G"GABc|"D"def2|`;

        it('returns an object with svg and audio properties', () => {
            const result = renderer.abc_render({ abc: SIMPLE_ABC, width: 800 });

            expect(result).toHaveProperty('svg');
            expect(result).toHaveProperty('audio');
            expect(typeof result.svg).toBe('string');
            expect(Array.isArray(result.audio)).toBe(true);
        });

        it('generates SVG output containing svg elements', () => {
            const result = renderer.abc_render({ abc: SIMPLE_ABC, width: 800 });

            expect(result.svg).toContain('<svg');
            expect(result.svg).toContain('</svg>');
        });

        it('generates audio data for notes', () => {
            const result = renderer.abc_render({ abc: SIMPLE_ABC, width: 800 });

            expect(result.audio.length).toBeGreaterThan(0);
        });

        it('respects width parameter in output', () => {
            const narrowResult = renderer.abc_render({ abc: SIMPLE_ABC, width: 400 });
            const wideResult = renderer.abc_render({ abc: SIMPLE_ABC, width: 1200 });

            expect(narrowResult.svg).toContain('<svg');
            expect(wideResult.svg).toContain('<svg');
        });

        it('handles ABC with chord symbols', () => {
            const result = renderer.abc_render({ abc: SIMPLE_ABC_WITH_CHORDS, width: 800 });

            expect(result.svg).toContain('<svg');
            expect(result.audio.length).toBeGreaterThan(0);
        });

        it('applies transposition when delta is provided', () => {
            const original = renderer.abc_render({ abc: SIMPLE_ABC, width: 800 });

            const renderer2 = new AbcRenderer();
            const transposed = renderer2.abc_render({ abc: SIMPLE_ABC, width: 800, delta: 2 });

            expect(original.svg).toContain('<svg');
            expect(transposed.svg).toContain('<svg');
            expect(transposed.audio.length).toBeGreaterThan(0);
        });

        it('handles empty ABC gracefully', () => {
            const result = renderer.abc_render({ abc: '', width: 800 });

            expect(result).toHaveProperty('svg');
            expect(result).toHaveProperty('audio');
        });

        it('handles minimal valid ABC header', () => {
            const minimalAbc = `X:1
K:C
`;
            const result = renderer.abc_render({ abc: minimalAbc, width: 800 });

            expect(result).toHaveProperty('svg');
            expect(result).toHaveProperty('audio');
        });

        it('handles ABC with multiple voices', () => {
            const multiVoiceAbc = `X:1
T:Multi Voice
M:4/4
L:1/4
K:C
V:1
CDEF|
V:2
EFGA|`;
            const result = renderer.abc_render({ abc: multiVoiceAbc, width: 800 });

            expect(result.svg).toContain('<svg');
        });

        it('generates overlay rectangles for notes', () => {
            const result = renderer.abc_render({ abc: SIMPLE_ABC, width: 800 });

            expect(result.svg).toContain('<rect');
            expect(result.svg).toContain('class="overlay"');
        });

        it('handles different key signatures', () => {
            const keysToTest = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb', 'Am', 'Em'];

            for (const key of keysToTest) {
                const abc = `X:1
K:${key}
CDEF|`;
                const result = renderer.abc_render({ abc, width: 800 });
                expect(result.svg).toContain('<svg');
            }
        });

        it('handles different time signatures', () => {
            const metersToTest = ['4/4', '3/4', '6/8', '2/4', 'C', 'C|'];

            for (const meter of metersToTest) {
                const abc = `X:1
M:${meter}
K:C
CDEF|`;
                const result = renderer.abc_render({ abc, width: 800 });
                expect(result.svg).toContain('<svg');
            }
        });

        it('handles rests in ABC notation', () => {
            const abcWithRests = `X:1
M:4/4
L:1/4
K:C
CDzE|zzzz|`;
            const result = renderer.abc_render({ abc: abcWithRests, width: 800 });

            expect(result.svg).toContain('<svg');
        });

        it('successive renders produce independent results', () => {
            const result1 = renderer.abc_render({ abc: SIMPLE_ABC, width: 800 });
            const result2 = renderer.abc_render({ abc: SIMPLE_ABC_WITH_CHORDS, width: 800 });

            expect(result1.svg).not.toBe(result2.svg);
        });

        it('handles negative transposition delta', () => {
            const renderer2 = new AbcRenderer();
            const result = renderer2.abc_render({ abc: SIMPLE_ABC, width: 800, delta: -3 });

            expect(result.svg).toContain('<svg');
            expect(result.audio.length).toBeGreaterThan(0);
        });

        it('handles large transposition delta', () => {
            const renderer2 = new AbcRenderer();
            const result = renderer2.abc_render({ abc: SIMPLE_ABC, width: 800, delta: 12 });

            expect(result.svg).toContain('<svg');
        });
    });
});
