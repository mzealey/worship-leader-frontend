import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { maybe_convert_solfege } from '../src/solfege-util';

// Mock the dependencies
vi.mock('../src/langpack', () => ({
    get_translation: vi.fn((key) => {
        const translations = {
            solf_C: 'Do',
            solf_D: 'Re',
            solf_E: 'Mi',
            solf_F: 'Fa',
            solf_G: 'Sol',
            solf_A: 'La',
            solf_B: 'Si',
        };
        return (translations as any)[key];
    }),
}));

vi.mock('../src/settings', () => ({
    is_set: vi.fn(),
}));

describe('solfege-util', function () {
    let is_set: Mock<typeof import('../src/settings').is_set>;

    beforeEach(async function () {
        const settingsStore = await import('../src/settings');
        is_set = settingsStore.is_set as Mock<typeof import('../src/settings').is_set>;
        vi.clearAllMocks();
    });

    describe('maybe_convert_solfege', function () {
        it('returns original value when solfege is disabled', function () {
            is_set.mockReturnValue(false);

            expect(maybe_convert_solfege('C D E')).toBe('C D E');
            expect(maybe_convert_solfege('Am Bm')).toBe('Am Bm');
        });

        it('converts notes to solfege when enabled', function () {
            is_set.mockReturnValue(true);

            expect(maybe_convert_solfege('C')).toBe('Do');
            expect(maybe_convert_solfege('D')).toBe('Re');
            expect(maybe_convert_solfege('E')).toBe('Mi');
            expect(maybe_convert_solfege('F')).toBe('Fa');
            expect(maybe_convert_solfege('G')).toBe('Sol');
            expect(maybe_convert_solfege('A')).toBe('La');
            expect(maybe_convert_solfege('B')).toBe('Si');
        });

        it('converts multiple notes in a string', function () {
            is_set.mockReturnValue(true);

            expect(maybe_convert_solfege('C D E')).toBe('Do Re Mi');
            expect(maybe_convert_solfege('F G A B')).toBe('Fa Sol La Si');
        });

        it('only converts word-boundary notes', function () {
            is_set.mockReturnValue(true);

            // Should convert standalone letters but not those within words
            expect(maybe_convert_solfege('C')).toBe('Do');
            // The regex uses \b[A-GH]\b so "AC" would match "A" at start boundary
            // but "C" is preceded by "A" so it gets matched separately
            expect(maybe_convert_solfege('AC')).toBe('LaC'); // A is at word boundary
        });

        it('converts Russian H notation to B', function () {
            is_set.mockReturnValue(true);

            expect(maybe_convert_solfege('H')).toBe('Si'); // H -> B -> Si
        });

        it('preserves chord modifiers', function () {
            is_set.mockReturnValue(true);

            // This tests the behavior but may need adjustment based on actual implementation
            // The function only replaces single uppercase letters A-H at word boundaries
            expect(maybe_convert_solfege('Cmaj7')).toBe('Domaj7');
            expect(maybe_convert_solfege('Am')).toBe('Lam');
        });

        it('handles empty string', function () {
            is_set.mockReturnValue(true);

            expect(maybe_convert_solfege('')).toBe('');
        });

        it('handles string with no notes', function () {
            is_set.mockReturnValue(true);

            expect(maybe_convert_solfege('hello world')).toBe('hello world');
        });

        it('handles mixed case', function () {
            is_set.mockReturnValue(true);

            // Only uppercase letters should be converted
            expect(maybe_convert_solfege('C c')).toBe('Do c');
        });

        it('checks use-solfege setting', function () {
            is_set.mockReturnValue(false);

            maybe_convert_solfege('C D E');

            expect(is_set).toHaveBeenCalledWith('setting-use-solfege');
        });
    });
});
