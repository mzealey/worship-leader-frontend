import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SET_DB } from '../src/set-db';
import { generate_set_share_link } from '../src/set-utils';

// Mock SET_DB
vi.mock('../src/set-db', () => ({
    SET_DB: {
        mark_shared_live: vi.fn(),
    },
}));

describe('set-utils', function () {
    describe('generate_set_share_link', function () {
        beforeEach(function () {
            vi.clearAllMocks();
        });

        it('generates link with basic set information', function () {
            const set = {
                id: 1,
                uuid: 'test-uuid-123',
                name: 'Sunday Service',
                live: 0 as 0 | 1,
                songs: [
                    { song_id: 1, song_key: 'C', capo: 0 },
                    { song_id: 2, song_key: 'G', capo: 2 },
                ],
            };

            const link = generate_set_share_link(set, false);

            expect(link).toContain('#page-set-list?');
            expect(link).toContain('new_set=Sunday%20Service');
            expect(link).toContain('song_ids=1%2C2');
            expect(link).toContain('keys=C%2CG');
            expect(link).toContain('capos=0%2C2');
        });

        it('includes set_uuid for live shares', function () {
            const set = {
                uuid: 'test-uuid-456',
                id: 123,
                name: 'Live Set',
                live: 0 as 0 | 1,
                songs: [{ song_id: 10, song_key: 'D', capo: 1 }],
            };

            const link = generate_set_share_link(set, true);

            expect(link).toContain('set_uuid=test-uuid-456');
            expect(SET_DB.mark_shared_live).toHaveBeenCalledWith(123, 1);
        });

        it('does not mark as shared_live if already live', function () {
            const set = {
                id: 1,
                uuid: 'test-uuid-empty',
                name: 'Empty Set',
                live: 1 as 0 | 1,
                songs: [] as any[],
            };

            generate_set_share_link(set, true);

            expect(SET_DB.mark_shared_live).not.toHaveBeenCalled();
        });

        it('handles empty songs array', function () {
            const set = {
                id: 1,
                uuid: 'test-uuid-empty',
                name: 'Empty Set',
                live: 0 as 0 | 1,
                songs: [] as any[],
            };

            const link = generate_set_share_link(set, false);

            expect(link).toContain('song_ids=');
            expect(link).toContain('keys=');
            expect(link).toContain('capos=');
        });

        it('handles set with single song', function () {
            const set = {
                id: 1,
                uuid: 'test-uuid-single',
                name: 'Single Song Set',
                live: 0 as 0 | 1,
                songs: [{ song_id: 42, song_key: 'F', capo: 3 }],
            };

            const link = generate_set_share_link(set, false);

            expect(link).toContain('song_ids=42');
            expect(link).toContain('keys=F');
            expect(link).toContain('capos=3');
        });

        it('URL encodes special characters in set name', function () {
            const set = {
                id: 1,
                uuid: 'test-uuid-encode',
                name: 'Set & Songs #1',
                live: 0 as 0 | 1,
                songs: [{ song_id: 1, song_key: 'C', capo: 0 }],
            };

            const link = generate_set_share_link(set, false);

            expect(link).toContain('new_set=Set%20%26%20Songs%20%231');
        });

        it('handles various key notations', function () {
            const set = {
                id: 1,
                uuid: 'test-uuid-keys',
                name: 'Various Keys',
                live: 0 as 0 | 1,
                songs: [
                    { song_id: 1, song_key: 'C#', capo: 0 },
                    { song_id: 2, song_key: 'Bb', capo: 1 },
                    { song_id: 3, song_key: 'F#m', capo: 2 },
                ],
            };

            const link = generate_set_share_link(set, false);

            expect(link).toContain('keys=C%23%2CBb%2CF%23m');
        });

        it('handles zero and non-zero capos', function () {
            const set = {
                id: 1,
                uuid: 'test-uuid-capos',
                name: 'Mixed Capos',
                live: 0 as 0 | 1,
                songs: [
                    { song_id: 1, song_key: 'C', capo: 0 },
                    { song_id: 2, song_key: 'D', capo: 5 },
                    { song_id: 3, song_key: 'E', capo: 7 },
                ],
            };

            const link = generate_set_share_link(set, false);

            expect(link).toContain('capos=0%2C5%2C7');
        });

        it('creates valid hash link format', function () {
            const set = {
                id: 1,
                uuid: 'test-uuid-hash',
                name: 'Test Set',
                live: 0 as 0 | 1,
                songs: [{ song_id: 1, song_key: 'C', capo: 0 }],
            };

            const link = generate_set_share_link(set, false);

            expect(link).toMatch(/^#page-set-list\?/);
        });
    });
});
