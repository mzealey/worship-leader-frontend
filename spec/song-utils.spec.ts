import { describe, expect, it } from 'vitest';
import { get_text_title } from '../src/song-utils';

describe('song-utils', function () {
    describe('get_text_title', function () {
        it('returns song title when no source title', function () {
            const song = { title: 'Amazing Grace', source_title: '' };
            expect(get_text_title(song)).toBe('Amazing Grace');
        });

        it('appends source title in parentheses when present', function () {
            const song = { title: 'Amazing Grace', source_title: 'Hymnal' };
            expect(get_text_title(song)).toBe('Amazing Grace (Hymnal)');
        });

        it('handles empty source title', function () {
            const song = { title: 'Amazing Grace', source_title: '' };
            // Empty source title is treated as falsy, so no parentheses added
            expect(get_text_title(song)).toBe('Amazing Grace');
        });

        it('handles songs with numbers in title', function () {
            const song = { title: 'Psalm 23', source_title: 'Book 1' };
            expect(get_text_title(song)).toBe('Psalm 23 (Book 1)');
        });

        it('handles special characters in titles', function () {
            const song = { title: "God's Love", source_title: 'Songs & Hymns' };
            expect(get_text_title(song)).toBe("God's Love (Songs & Hymns)");
        });

        it('handles unicode characters in titles', function () {
            const song = { title: 'Señor', source_title: 'Español' };
            expect(get_text_title(song)).toBe('Señor (Español)');
        });
    });
});
