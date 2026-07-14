import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SetSong } from '../src/set-db';

describe('SetSwitcher', function () {
    let SetSwitcher: typeof import('../src/set-switcher').SetSwitcher;
    let mockSET_DB: {
        get_songs: ReturnType<typeof vi.fn>;
        find_song_position_in_set: ReturnType<typeof vi.fn>;
    };

    const createSongs = (count: number): SetSong[] =>
        Array.from({ length: count }, (_, i) => ({
            song_id: i + 1,
            song_key: 'C',
            capo: 0,
        }));

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        mockSET_DB = {
            get_songs: vi.fn(),
            find_song_position_in_set: vi.fn(),
        };

        vi.doMock('../src/set-db', () => ({
            SET_DB: mockSET_DB,
        }));

        const mod = await import('../src/set-switcher');
        SetSwitcher = mod.SetSwitcher;
    });

    afterEach(() => {
        vi.resetModules();
    });

    describe('constructor', function () {
        it('initializes with set_id and song_id', function () {
            mockSET_DB.get_songs.mockReturnValue(createSongs(3));
            mockSET_DB.find_song_position_in_set.mockReturnValue({ position: 0 });

            const switcher = new SetSwitcher(1, 2);

            expect(switcher.set_id).toBe(1);
            expect(switcher.songs).toHaveLength(3);
            expect(mockSET_DB.get_songs).toHaveBeenCalledWith(1);
            expect(mockSET_DB.find_song_position_in_set).toHaveBeenCalledWith(1, 2);
        });

        it('handles set with no songs', function () {
            mockSET_DB.get_songs.mockReturnValue([]);
            mockSET_DB.find_song_position_in_set.mockReturnValue({ position: -1 });

            const switcher = new SetSwitcher(1, 1);

            expect(switcher.songs).toEqual([]);
            expect(switcher.position()).toBe(-1);
        });
    });

    describe('cur_song_id', function () {
        it('updates position for new song', function () {
            mockSET_DB.get_songs.mockReturnValue(createSongs(3));
            mockSET_DB.find_song_position_in_set.mockReturnValueOnce({ position: 0 }).mockReturnValueOnce({ position: 1 });

            const switcher = new SetSwitcher(1, 1);
            switcher.cur_song_id(2);

            expect(switcher.position()).toBe(1);
        });

        it('sets position to -1 when song is not in set', function () {
            mockSET_DB.get_songs.mockReturnValue(createSongs(3));
            mockSET_DB.find_song_position_in_set.mockReturnValueOnce({ position: 1 }).mockReturnValueOnce(undefined);

            const switcher = new SetSwitcher(1, 1);
            switcher.cur_song_id(999);

            expect(switcher.position()).toBe(-1);
        });
    });

    describe('can_prev', function () {
        it('returns false when at position 0', function () {
            mockSET_DB.get_songs.mockReturnValue(createSongs(3));
            mockSET_DB.find_song_position_in_set.mockReturnValue({ position: 0 });

            const switcher = new SetSwitcher(1, 1);
            expect(switcher.can_prev()).toBe(false);
        });

        it('returns true when at position > 0', function () {
            mockSET_DB.get_songs.mockReturnValue(createSongs(3));
            mockSET_DB.find_song_position_in_set.mockReturnValue({ position: 1 });

            const switcher = new SetSwitcher(1, 2);
            expect(switcher.can_prev()).toBe(true);
        });

        it('returns false when position is -1', function () {
            mockSET_DB.get_songs.mockReturnValue(createSongs(3));
            mockSET_DB.find_song_position_in_set.mockReturnValue({ position: -1 });

            const switcher = new SetSwitcher(1, 1);
            expect(switcher.can_prev()).toBe(false);
        });
    });

    describe('can_next', function () {
        it('returns true when not at last position', function () {
            mockSET_DB.get_songs.mockReturnValue(createSongs(3));
            mockSET_DB.find_song_position_in_set.mockReturnValue({ position: 1 });

            const switcher = new SetSwitcher(1, 2);
            expect(switcher.can_next()).toBe(true);
        });

        it('returns false when at last position', function () {
            mockSET_DB.get_songs.mockReturnValue(createSongs(3));
            mockSET_DB.find_song_position_in_set.mockReturnValue({ position: 2 });

            const switcher = new SetSwitcher(1, 3);
            expect(switcher.can_next()).toBe(false);
        });

        it('returns true for single song at position 0', function () {
            mockSET_DB.get_songs.mockReturnValue(createSongs(1));
            mockSET_DB.find_song_position_in_set.mockReturnValue({ position: 0 });

            const switcher = new SetSwitcher(1, 1);
            expect(switcher.can_next()).toBe(false);
        });
    });

    describe('move', function () {
        it('moves forward by 1', function () {
            mockSET_DB.get_songs.mockReturnValue(createSongs(3));
            mockSET_DB.find_song_position_in_set.mockReturnValue({ position: 0 });

            const switcher = new SetSwitcher(1, 1);
            expect(switcher.move(1)).toBe(2);
        });

        it('moves backward by 1', function () {
            mockSET_DB.get_songs.mockReturnValue(createSongs(3));
            mockSET_DB.find_song_position_in_set.mockReturnValue({ position: 1 });

            const switcher = new SetSwitcher(1, 2);
            expect(switcher.move(-1)).toBe(1);
        });

        it('clamps to first song when moving past start', function () {
            mockSET_DB.get_songs.mockReturnValue(createSongs(3));
            mockSET_DB.find_song_position_in_set.mockReturnValue({ position: 0 });

            const switcher = new SetSwitcher(1, 1);
            expect(switcher.move(-1)).toBe(1);
        });

        it('clamps to last song when moving past end', function () {
            mockSET_DB.get_songs.mockReturnValue(createSongs(3));
            mockSET_DB.find_song_position_in_set.mockReturnValue({ position: 2 });

            const switcher = new SetSwitcher(1, 3);
            expect(switcher.move(1)).toBe(3);
        });

        it('returns current song_id for empty set', function () {
            mockSET_DB.get_songs.mockReturnValue([]);
            mockSET_DB.find_song_position_in_set.mockReturnValue({ position: -1 });

            const switcher = new SetSwitcher(1, 42);
            expect(switcher.move(1)).toBe(42);
        });
    });
});
