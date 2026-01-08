import { describe, expect, it, vi } from 'vitest';

import { JSDOM } from 'jsdom';
const jsdom = new JSDOM('<!doctype html><html><body></body></html>');
global.window = jsdom.window as unknown as Window & typeof globalThis;
global.document = jsdom.window.document;
global.Node = jsdom.window.Node;

import { add_chord_zwjs, convert_to_elvanto, convert_to_pre, format_html_chords, songxml_to_divs } from '../src/songxml-util';

describe('songxml', function () {
    describe('convert_to_pre', function () {
        it('passes basic test', function () {
            expect(convert_to_pre('<verse><chord>Am</chord>Foo</verse>')).toBe('Am\nFoo');
        });
        it('handles broken <br>s', function () {
            expect(convert_to_pre('<verse><chord>Am</chord>Foo<br>Bar<br />Foo</verse>')).toBe('Am\nFoo\nBar\nFoo');
        });
        it('handles repeats', function () {
            expect(convert_to_pre('<verse><repeat><chord>Am</chord>Foo<br />Bar<br />Foo</repeat></verse>')).toBe('   Am\n// Foo\nBar\nFoo //');
        });
        it('handles repeats with counts', function () {
            expect(convert_to_pre('<verse><repeat count=2><chord>Am</chord>Foo<br />Bar<br />Foo</repeat></verse>')).toBe('   Am\n// Foo\nBar\nFoo //');
        });
        it('handles extended repeats', function () {
            expect(convert_to_pre('<verse><repeat count=4><chord>Am</chord>Foo<br />Bar<br />Foo</repeat></verse>')).toBe('     Am\n//// Foo\nBar\nFoo ////');
        });
        it('handles repeat counts with quotes', function () {
            expect(convert_to_pre('<verse><repeat count="4"><chord>Am</chord>Foo<br />Bar<br />Foo</repeat></verse>')).toBe('     Am\n//// Foo\nBar\nFoo ////');
            expect(convert_to_pre("<verse><repeat count='4'><chord>Am</chord>Foo<br />Bar<br />Foo</repeat></verse>")).toBe('     Am\n//// Foo\nBar\nFoo ////');
        });

        it('handles chord formatting', function () {
            expect(convert_to_pre('<verse><chord>Am</chord>F<chord>B&amp;</chord>oo</verse>')).toBe('Am Bb\nF--oo');
            expect(convert_to_pre('<verse><chord>A</chord>F<chord>B&amp;</chord>oo</verse>')).toBe('A  Bb\nF--oo');
            expect(convert_to_pre('<verse><chord>A</chord>F <chord>B&amp;</chord>oo</verse>')).toBe('A Bb\nF oo');
            expect(convert_to_pre('<verse>E<chord>A</chord>Foo</verse>')).toBe(' A\nEFoo');
            expect(convert_to_pre('<verse>EF<chord>A</chord>oo</verse>')).toBe('  A\nEFoo');
            expect(convert_to_pre('<verse>hayranım Sa<chord>C</chord>n<chord>D</chord></verse>')).toBe('           C  D\nhayranım San--');
            expect(convert_to_pre('<verse>hayranım Sa<chord>C</chord>na<chord>D</chord></verse>')).toBe('           C D\nhayranım Sana');
        });

        it('handles opensong format', function () {
            const result = convert_to_pre('<verse><chord>Am</chord>Hello<br />World</verse>', true);
            expect(result).toBe('[V1]\n.Am\n Hello\n World');
        });

        it('handles opensong format with multiple verse types', function () {
            const result = convert_to_pre('<verse>Line1</verse><chorus>Chorus1</chorus><verse>Line2</verse>', true);
            expect(result).toBe('[V1]\n Line1\n\n[C1]\n   Chorus1\n\n[V2]\n Line2');
        });

        it('handles without_chords option', function () {
            const result = convert_to_pre('<verse><chord>Am</chord>Hello<chord>G</chord>World</verse>', false, true);
            expect(result).toBe('HelloWorld');
        });

        it('handles indent tags', function () {
            const result = convert_to_pre('<verse><indent></indent>Indented line</verse>');
            expect(result).toBe('    Indented line');
        });

        it('adds indent for non-verse sections', function () {
            const verseResult = convert_to_pre('<verse>Verse line</verse>');
            const chorusResult = convert_to_pre('<chorus>Chorus line</chorus>');
            expect(verseResult).toBe('Verse line');
            expect(chorusResult).toBe('  Chorus line');
        });

        it('handles chords-only lines', function () {
            const result = convert_to_pre('<verse><chord>Am</chord><chord>G</chord><br />Lyrics here</verse>');
            expect(result).toBe('AmG\n \nLyrics here');
        });

        it('handles opensong underscore fill character', function () {
            const result = convert_to_pre('<verse><chord>Am</chord>F<chord>G</chord>oo</verse>', true);
            expect(result).toBe('[V1]\n.Am G\n F__oo');
        });
    });

    describe('convert_to_elvanto', function () {
        it('converts basic songxml to elvanto format', function () {
            const result = convert_to_elvanto('<verse>Hello World</verse>');
            expect(result).toBe('[verse 1]\nHello World');
        });

        it('includes inline chord notation', function () {
            const result = convert_to_elvanto('<verse><chord>Am</chord>Hello<chord>G</chord>World</verse>');
            expect(result).toBe('[verse 1]\n[Am]Hello[G]World');
        });

        it('handles br tags as newlines', function () {
            const result = convert_to_elvanto('<verse>Line1<br />Line2</verse>');
            expect(result).toBe('[verse 1]\nLine1\nLine2');
        });

        it('handles indent tags', function () {
            const result = convert_to_elvanto('<verse><indent></indent>Indented</verse>');
            expect(result).toBe('[verse 1]\n    Indented');
        });

        it('handles multiple sections with numbering', function () {
            const result = convert_to_elvanto('<verse>V1</verse><verse>V2</verse><chorus>C1</chorus>');
            expect(result).toBe('[verse 1]\nV1\n\n[verse 2]\nV2\n\n[chorus 1]\nC1');
        });

        it('handles without_chords option', function () {
            const result = convert_to_elvanto('<verse><chord>Am</chord>Hello</verse>', true);
            expect(result).toBe('[verse 1]\nHello');
        });

        it('replaces ampersand with b for flat chords', function () {
            const result = convert_to_elvanto('<verse><chord>B&amp;</chord>Test</verse>');
            expect(result).toBe('[verse 1]\n[Bb]Test');
        });

        it('handles whitespace in chords', function () {
            const result = convert_to_elvanto('<verse><chord>Am  </chord>Test</verse>');
            expect(result).toBe('[verse 1]\n[Am ]Test');
        });
    });

    describe('format_html_chords', function () {
        it('handles null input', function () {
            expect(() => format_html_chords(null)).not.toThrow();
        });

        it('handles jQuery-like objects with index 0', function () {
            const elem = document.createElement('div');
            const jQueryLike = { 0: elem };
            expect(() => format_html_chords(jQueryLike)).not.toThrow();
        });

        it('handles direct HTMLElement', function () {
            const elem = document.createElement('div');
            expect(() => format_html_chords(elem)).not.toThrow();
        });

        it('removes rendered class and schedules re-render', function () {
            vi.useFakeTimers();

            const elem = document.createElement('div');
            elem.classList.add('rendered');
            elem.innerHTML = '<span class="chord">Am</span>';

            format_html_chords(elem);

            expect(elem.classList.contains('rendered')).toBe(false);

            vi.useRealTimers();
        });
    });

    describe('add_chord_zwjs', function () {
        it('adds zero-width joiners around chords in middle of words', function () {
            const result = add_chord_zwjs('wo<chord>A</chord>rd');
            expect(result).toBe('wo\u200D<chord>A</chord>\u200Drd');
        });

        it('does not add zwj at word boundaries', function () {
            const result = add_chord_zwjs(' <chord>A</chord> ');
            expect(result).toBe(' <chord>A</chord> ');
        });

        it('does not add zwj after punctuation', function () {
            const result = add_chord_zwjs('.<chord>A</chord>word');
            expect(result).toBe('.<chord>A</chord>word');
        });

        it('does not add zwj before punctuation', function () {
            const result = add_chord_zwjs('word<chord>A</chord>.');
            expect(result).toBe('word<chord>A</chord>.');
        });

        it('handles Arabic non-joining characters', function () {
            const result = add_chord_zwjs('\u0627<chord>A</chord>test');
            expect(result).toBe('\u0627<chord>A</chord>test');
        });
    });

    describe('songxml_to_divs', function () {
        it('returns empty string for null input', function () {
            expect(songxml_to_divs(null)).toBe('');
        });

        it('returns empty string for undefined input', function () {
            expect(songxml_to_divs(undefined)).toBe('');
        });

        it('returns empty string for empty string input', function () {
            expect(songxml_to_divs('')).toBe('');
        });

        it('returns empty string for whitespace-only content', function () {
            expect(songxml_to_divs('<verse>   </verse>')).toBe('');
        });

        it('converts verse tags to divs', function () {
            const result = songxml_to_divs('<verse>Content</verse>');
            expect(result).toBe('<div class="verse">Content</div>');
        });

        it('converts chorus tags to divs', function () {
            const result = songxml_to_divs('<chorus>Content</chorus>');
            expect(result).toBe('<div class="chorus">Content</div>');
        });

        it('converts bridge tags to divs', function () {
            const result = songxml_to_divs('<bridge>Content</bridge>');
            expect(result).toBe('<div class="bridge">Content</div>');
        });

        it('converts prechorus tags to divs', function () {
            const result = songxml_to_divs('<prechorus>Content</prechorus>');
            expect(result).toBe('<div class="prechorus">Content</div>');
        });

        it('converts indent tags to spans', function () {
            const result = songxml_to_divs('<verse><indent>Indented</indent></verse>');
            expect(result).toBe('<div class="verse"><span class="indent">Indented</span></div>');
        });

        it('converts repeat tags to spans with attributes', function () {
            const result = songxml_to_divs('<verse><repeat count="2">Repeated</repeat></verse>');
            expect(result).toBe('<div class="verse"><span class="repeat"  count="2">Repeated</span></div>');
        });

        it('removes chords when without_chords is true', function () {
            const result = songxml_to_divs('<verse><chord>Am</chord>Hello</verse>', true);
            expect(result).toBe('<div class="verse">Hello</div>');
        });

        it('removes chordsonly tags when without_chords is true', function () {
            const result = songxml_to_divs('<verse><chordsonly>Am G</chordsonly>Hello</verse>', true);
            expect(result).toBe('<div class="verse">Hello</div>');
        });

        it('wraps words with chords in word-with-chord span', function () {
            const result = songxml_to_divs('<verse>Hel<chord>Am</chord>lo</verse>');
            expect(result).toBe(
                '<div class="verse"><span class=\'word-with-chord\'>Hel\u200D<ruby class="chord">\u200Dlo<rt>&#x202D;Am</rt></ruby></span></div>',
            );
        });

        it('converts chord tags to ruby elements', function () {
            const result = songxml_to_divs('<verse><chord>Am</chord>Hello</verse>');
            expect(result).toBe('<div class="verse"><span class=\'word-with-chord\'><ruby class="chord">Hello<rt>&#x202D;Am</rt></ruby></span></div>');
        });

        it('applies chord_color when provided', function () {
            const result = songxml_to_divs('<verse><chord>Am</chord>Hello</verse>', false, '#ff0000');
            expect(result).toBe(
                '<div class="verse"><span class=\'word-with-chord\'><ruby class="chord" style="color: #ff0000">Hello<rt>&#x202D;Am</rt></ruby></span></div>',
            );
        });

        it('adds zero-width joiners for mid-word chords', function () {
            const result = songxml_to_divs('<verse>wo<chord>Am</chord>rd</verse>');
            expect(result).toBe(
                '<div class="verse"><span class=\'word-with-chord\'>wo\u200D<ruby class="chord">\u200Drd<rt>&#x202D;Am</rt></ruby></span></div>',
            );
        });

        it('preserves chord content in html output', function () {
            const result = songxml_to_divs('<verse><chord>Am7</chord>Test</verse>');
            expect(result).toBe('<div class="verse"><span class=\'word-with-chord\'><ruby class="chord">Test<rt>&#x202D;Am7</rt></ruby></span></div>');
        });
    });
});
