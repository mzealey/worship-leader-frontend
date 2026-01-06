import { describe, expect, it } from 'vitest';

import { JSDOM } from 'jsdom';
const jsdom = new JSDOM('<!doctype html><html><body></body></html>');
global.window = jsdom.window;

import { convert_to_pre } from '../src/songxml-util';

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
    });
});
