import { beforeEach, describe, expect, it } from 'vitest';
import { Song } from '../src/song';
import { TransposeDetails } from '../src/transpose-details';

describe('TransposeDetails', function () {
    let mockSong: Song;

    beforeEach(function () {
        mockSong = {
            id: 123,
            songkey: 'C',
            capo: 0,
        } as Song;
    });

    describe('constructor', function () {
        it('initializes with song properties', function () {
            const details = new TransposeDetails(mockSong);

            expect(details.song_id).toBe(123);
            expect(details.keyName).toBe('C');
            expect(details.capo).toBe(0);
            expect(details.song_capo).toBe(0);
        });

        it('handles song with capo', function () {
            mockSong.capo = 2;
            const details = new TransposeDetails(mockSong);

            expect(details.capo).toBe(2);
            expect(details.song_capo).toBe(2);
        });

        it('handles minor keys', function () {
            mockSong.songkey = 'Am';
            const details = new TransposeDetails(mockSong);

            expect(details.keyName).toBe('Am');
            expect(details.is_minor).toBe(true);
            expect(details.startKeyName).toBe('A');
        });

        it('handles major keys', function () {
            mockSong.songkey = 'G';
            const details = new TransposeDetails(mockSong);

            expect(details.keyName).toBe('G');
            expect(details.is_minor).toBe(false);
            expect(details.startKeyName).toBe('G');
        });

        it('handles song with no key', function () {
            mockSong.songkey = '';
            const details = new TransposeDetails(mockSong);

            expect(details.keyName).toBeUndefined();
            expect(details.key).toBeUndefined();
            expect(details.startKey).toBeUndefined();
        });

        it('stores set_id when provided', function () {
            const details = new TransposeDetails(mockSong, 456);

            expect(details.set_id).toBe(456);
        });
    });

    describe('get_total_delta', function () {
        it('returns zero when no transposition', function () {
            const details = new TransposeDetails(mockSong);
            expect(details.get_total_delta()).toBe(0);
        });

        it('calculates delta with transposition', function () {
            const details = new TransposeDetails(mockSong);
            details.delta = 3;
            expect(details.get_total_delta()).toBe(3);
        });

        it('accounts for capo changes', function () {
            mockSong.capo = 2;
            const details = new TransposeDetails(mockSong);
            details.capo = 3;
            details.delta = 5;

            // delta - capo + song_capo = 5 - 3 + 2 = 4
            expect(details.get_total_delta()).toBe(4);
        });

        it('handles negative delta', function () {
            const details = new TransposeDetails(mockSong);
            details.delta = -2;
            expect(details.get_total_delta()).toBe(-2);
        });
    });

    describe('update_key', function () {
        it('updates key and calculates delta', function () {
            mockSong.songkey = 'C';
            const details = new TransposeDetails(mockSong);

            details.update_key('D');

            expect(details.keyName).toBe('D');
            expect(details.delta).toBe(2); // C to D is +2 semitones
        });

        it('handles wrapping around octave', function () {
            mockSong.songkey = 'B';
            const details = new TransposeDetails(mockSong);

            details.update_key('C');

            expect(details.keyName).toBe('C');
            expect(details.delta).toBe(1); // B to C is +1 semitone
        });

        it('emits update event', function () {
            const details = new TransposeDetails(mockSong);
            let updateCalled = false;

            details.subscribe(() => {
                updateCalled = true;
            });

            details.update_key('D');

            expect(updateCalled).toBe(true);
        });

        it('handles numeric key when no start key', function () {
            mockSong.songkey = '';
            const details = new TransposeDetails(mockSong);

            details.update_key(5);

            expect(details.keyName).toBe(5);
            expect(details.delta).toBe(5);
        });
    });

    describe('update_capo', function () {
        it('updates capo value', function () {
            const details = new TransposeDetails(mockSong);

            details.update_capo(3, false);

            expect(details.capo).toBe(3);
        });

        it('stores numeric capo value', function () {
            const details = new TransposeDetails(mockSong);

            details.update_capo(5, false);

            expect(details.capo).toBe(5);
            expect(typeof details.capo).toBe('number');
        });

        it('emits update event', function () {
            const details = new TransposeDetails(mockSong);
            let updateCalled = false;

            details.subscribe(() => {
                updateCalled = true;
            });

            details.update_capo(2, false);

            expect(updateCalled).toBe(true);
        });
    });

    describe('subscribe', function () {
        it('allows subscribing to updates', function () {
            const details = new TransposeDetails(mockSong);
            let callCount = 0;

            details.subscribe(() => {
                callCount++;
            });

            details.update_key('D');
            details.update_capo(2, false);

            expect(callCount).toBe(2);
        });

        it('passes value to subscriber', function () {
            const details = new TransposeDetails(mockSong);
            let receivedValue;

            details.subscribe((val) => {
                receivedValue = val;
            });

            details.update_key('D');

            expect(receivedValue).toBe(1);
        });
    });

    describe('integration with real transpositions', function () {
        it('transposes from C to G correctly', function () {
            mockSong.songkey = 'C';
            const details = new TransposeDetails(mockSong);

            details.update_key('G');

            expect(details.delta).toBe(7);
            expect(details.get_total_delta()).toBe(7);
        });

        it('transposes with capo applied', function () {
            mockSong.songkey = 'C';
            mockSong.capo = 2;
            const details = new TransposeDetails(mockSong);

            details.update_key('D');
            details.update_capo(3, false);

            // D is +2 from C, capo changed from 2 to 3 (net -1)
            // delta - capo + song_capo = 2 - 3 + 2 = 1
            expect(details.get_total_delta()).toBe(1);
        });

        it('handles minor key transposition', function () {
            mockSong.songkey = 'Am';
            const details = new TransposeDetails(mockSong);

            details.update_key('Dm');

            expect(details.is_minor).toBe(true);
            expect(details.delta).toBe(5); // A to D is +5 semitones
        });
    });
});
