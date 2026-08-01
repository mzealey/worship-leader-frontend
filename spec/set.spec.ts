import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('set', function () {
    let setMod: typeof import('../src/set');
    let mockSET_DB: {
        create_set: ReturnType<typeof vi.fn>;
        create_live_set: ReturnType<typeof vi.fn>;
        add_songs_to_set: ReturnType<typeof vi.fn>;
    };

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));

        mockSET_DB = {
            create_set: vi.fn().mockResolvedValue(1),
            create_live_set: vi.fn().mockResolvedValue(1),
            add_songs_to_set: vi.fn().mockResolvedValue(undefined),
        };

        vi.doMock('../src/set-db', () => ({
            SET_DB: mockSET_DB,
        }));

        setMod = await import('../src/set');
    });

    afterEach(() => {
        vi.resetModules();
        vi.useRealTimers();
    });

    describe('create_set_from_url', function () {
        it('creates a normal set with name and songs', async function () {
            const result = await setMod.create_set_from_url({
                new_set: 'Test Set',
                song_ids: '1,2,3',
            });

            expect(result).toBe(1);
            expect(mockSET_DB.create_set).toHaveBeenCalledWith('Test Set');
            expect(mockSET_DB.add_songs_to_set).toHaveBeenCalledWith(1, [
                { song_id: 1, song_key: undefined, capo: NaN },
                { song_id: 2, song_key: undefined, capo: NaN },
                { song_id: 3, song_key: undefined, capo: NaN },
            ]);
        });

        it('creates a normal set with keys and capos', async function () {
            const result = await setMod.create_set_from_url({
                new_set: 'With Keys',
                song_ids: '1,2',
                keys: 'C,D',
                capos: '0,2',
            });

            expect(result).toBe(1);
            expect(mockSET_DB.add_songs_to_set).toHaveBeenCalledWith(1, [
                { song_id: 1, song_key: 'C', capo: 0 },
                { song_id: 2, song_key: 'D', capo: 2 },
            ]);
        });

        it('creates a live set from set_uuid', async function () {
            const result = await setMod.create_set_from_url({
                set_uuid: 'test-uuid-123',
            });

            expect(result).toBe(1);
            expect(mockSET_DB.create_live_set).toHaveBeenCalledWith('test-uuid-123');
            expect(mockSET_DB.create_set).not.toHaveBeenCalled();
        });

        it('handles empty name defaulting to empty string', async function () {
            const result = await setMod.create_set_from_url({
                song_ids: '1',
            });

            expect(result).toBe(1);
            expect(mockSET_DB.create_set).toHaveBeenCalledWith('');
        });

        it('debounces rapid calls', async function () {
            const firstPromise = setMod.create_set_from_url({
                new_set: 'Test',
                song_ids: '1',
            });

            await expect(
                setMod.create_set_from_url({
                    new_set: 'Test2',
                    song_ids: '2',
                }),
            ).rejects.toThrow('Debounced');

            await firstPromise;
        });

        it('allows calls after debounce time', async function () {
            const first = await setMod.create_set_from_url({
                new_set: 'First',
                song_ids: '1',
            });

            expect(first).toBe(1);

            // Advance past debounce
            vi.advanceTimersByTime(200);

            // Need fresh module to reset last_set_add
            vi.resetModules();
            mockSET_DB = {
                create_set: vi.fn().mockResolvedValue(2),
                create_live_set: vi.fn().mockResolvedValue(2),
                add_songs_to_set: vi.fn().mockResolvedValue(undefined),
            };
            vi.doMock('../src/set-db', () => ({
                SET_DB: mockSET_DB,
            }));
            setMod = await import('../src/set');

            const second = await setMod.create_set_from_url({
                new_set: 'Second',
                song_ids: '2',
            });

            expect(second).toBe(2);
        });

        it('handles URL-encoded commas in keys', async function () {
            await setMod.create_set_from_url({
                new_set: 'URL Encoded',
                song_ids: '1,2',
                keys: 'C%23%2CD%23',
            });

            // %2C decodes to , which then splits; %23 decodes to #
            expect(mockSET_DB.add_songs_to_set).toHaveBeenCalledWith(1, [
                { song_id: 1, song_key: 'C#', capo: NaN },
                { song_id: 2, song_key: 'D#', capo: NaN },
            ]);
        });
    });
});
