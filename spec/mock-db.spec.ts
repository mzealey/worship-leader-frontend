import { beforeEach, describe, expect, it } from 'vitest';
import type { Song } from '../src/song';
import { MockDB } from './helpers/mock-db';

describe('MockDB', () => {
    let db: MockDB;

    beforeEach(() => {
        db = new MockDB();
    });

    it('returns empty results with no songs', async () => {
        const result = await db._run_search({ search: '', order_by: 'default' }, { start: 0, size: 10 });
        expect(result.data).toEqual([]);
        expect(result.total).toBe(0);
    });

    it('finds songs by search text', async () => {
        db.setSongs([
            { id: 1, title: 'Amazing Grace', search_title: 'amazing grace', search_text: 'amazing grace how sweet the sound', lang: 'en' } as Song,
            { id: 2, title: 'How Great Thou Art', search_title: 'how great thou art', search_text: 'oh lord my god', lang: 'en' } as Song,
            { id: 3, title: 'Test', search_title: 'test', search_text: 'test lyrics', lang: 'tr' } as Song,
        ]);

        const result = await db._run_search({ search: 'grace', order_by: 'default' }, { start: 0, size: 10 });
        expect(result.data).toHaveLength(1);
        expect(result.data[0].id).toBe(1);
    });

    it('filters by language', async () => {
        db.setSongs([{ id: 1, title: 'English', lang: 'en' } as Song, { id: 2, title: 'Turkish', lang: 'tr' } as Song]);

        const result = await db._run_search({ search: '', order_by: 'default', lang: 'tr' }, { start: 0, size: 10 });
        expect(result.data).toHaveLength(1);
        expect(result.data[0].id).toBe(2);
    });

    it('finds songs by ID search pattern', async () => {
        db.setSongs([{ id: 42, title: 'Song 42' } as Song, { id: 99, title: 'Song 99' } as Song]);

        const result = await db._run_search({ search: 'i42', order_by: 'default' }, { start: 0, size: 10 });
        expect(result.data).toHaveLength(1);
        expect(result.data[0].id).toBe(42);
    });

    it('paginates results', async () => {
        const songs: Song[] = [];
        for (let i = 1; i <= 25; i++) {
            songs.push({ id: i, title: `Song ${i}`, lang: 'en' } as Song);
        }
        db.setSongs(songs);

        const page1 = await db._run_search({ search: '', order_by: 'default' }, { start: 0, size: 10 });
        expect(page1.data).toHaveLength(10);
        expect(page1.data[0].id).toBe(1);

        const page2 = await db._run_search({ search: '', order_by: 'default' }, { start: 10, size: 10 });
        expect(page2.data).toHaveLength(10);
        expect(page2.data[0].id).toBe(11);
    });
});
