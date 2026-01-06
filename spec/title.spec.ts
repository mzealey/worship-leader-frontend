// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { set_title } from '../src/title';

// Mock the langpack module
vi.mock('../src/langpack', () => ({
    get_translation: vi.fn((key) => {
        if (key === 'worship-leader') return 'Worship Leader';
        return key;
    }),
}));

describe('title functions', function () {
    describe('set_title', function () {
        it('sets title with provided title and app name', function () {
            set_title('My Song');
            expect(document.title).toBe('My Song - Worship Leader');
        });

        it('sets title with just app name when no title provided', function () {
            set_title('');
            expect(document.title).toBe('Worship Leader');
        });

        it('sets title with just app name when undefined title provided', function () {
            set_title(undefined);
            expect(document.title).toBe('Worship Leader');
        });

        it('handles title with special characters', function () {
            set_title('Song #1 (Verse)');
            expect(document.title).toBe('Song #1 (Verse) - Worship Leader');
        });

        it('handles long titles', function () {
            const longTitle = 'This is a very long song title that might be used in some cases';
            set_title(longTitle);
            expect(document.title).toBe(`${longTitle} - Worship Leader`);
        });

        it('handles empty string as falsy', function () {
            set_title('');
            expect(document.title).toBe('Worship Leader');
        });
    });
});
