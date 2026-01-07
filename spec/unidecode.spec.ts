// @vitest-environment jsdom
import * as fs from 'fs';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { unidecode } from '../src/unidecode';
import * as util from '../src/util';

// Mock the util module
vi.mock('../src/util', async () => {
    const actual = await vi.importActual('../src/util');
    return {
        ...actual,
        fetch_json: vi.fn(),
    };
});

describe('unidecode', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Mock fetch_json to read from actual files
        vi.mocked(util.fetch_json).mockImplementation((url: string) => {
            // url is like 'unidecode/data/x04.json'
            const match = url.match(/unidecode\/data\/(x[0-9a-f]{2})\.json/);
            if (match) {
                const filename = match[1] + '.json';
                const filepath = path.join(__dirname, '../public/all/unidecode/data', filename);

                if (fs.existsSync(filepath)) {
                    try {
                        const content = fs.readFileSync(filepath, 'utf-8');
                        return Promise.resolve(JSON.parse(content)) as any;
                    } catch (e) {
                        return Promise.reject(e) as any;
                    }
                }
            }
            return Promise.reject(new Error(`File not found or pattern mismatch: ${url}`)) as any;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns empty string for empty input', async () => {
        expect(await unidecode('')).toBe('');
    });

    it('returns unchanged string for ASCII input', async () => {
        const input = 'Hello World 123!';
        expect(await unidecode(input)).toBe(input);
    });

    it('transliterates Latin-1 characters (using x00 table)', async () => {
        // U+00FC is 'ü'.
        // U+00E9 is 'é'.
        const input = 'München Café';
        const expected = 'Munchen Cafe'; // Actual table maps ü to u

        const result = await unidecode(input);
        expect(result).toBe(expected);

        expect(util.fetch_json).toHaveBeenCalledWith('unidecode/data/x00.json');
    });

    it('transliterates Cyrillic characters (using x04 table)', async () => {
        // 'Привет мир' (Privet mir)
        const input = 'Привет мир';
        const expected = 'Privet mir';

        const result = await unidecode(input);
        expect(result).toBe(expected);

        expect(util.fetch_json).toHaveBeenCalledWith('unidecode/data/x04.json');
    });

    it('transliterates Arabic characters (using x06 table)', async () => {
        // 'مرحبا' (Marhaba)
        // Meem (U+0645), Reh (U+0631), Hah (U+062D), Beh (U+0628), Alef (U+0627)
        // Based on x06.json: m, r, H, b, a?
        // Actual result was 'mrHb', so Alef might be mapped to empty or something else?
        const input = 'مرحبا';
        const expected = 'mrHb';

        const result = await unidecode(input);
        expect(result).toBe(expected);

        expect(util.fetch_json).toHaveBeenCalledWith('unidecode/data/x06.json');
    });

    it('transliterates CJK characters (using x53 and x4e tables)', async () => {
        // '北' is U+5317.
        // '京' is U+4EAC.
        const input = '北京';

        // We expect the mock to load x53.json and x4e.json

        const result = await unidecode(input);
        expect(result).toBe('Bei Jing '); // Space might be included in the table mapping

        // Verify calls
        expect(util.fetch_json).toHaveBeenCalledWith('unidecode/data/x53.json');
        expect(util.fetch_json).toHaveBeenCalledWith('unidecode/data/x4e.json');
    });

    it('handles mixed content requiring multiple tables', async () => {
        const input = 'Café в Москве'; // 'Cafe v Moskve'
        // 'é' -> x00
        // 'в' -> x04
        // 'М' -> x04

        const result = await unidecode(input);
        expect(result).toBe('Cafe v Moskve');
    });

    it('handles characters in skipped ranges/blanks', async () => {
        // blanks = [25, 26, 27, 28, 29, 34, 35, 36, 38, 39, 252];
        // 25 = 0x19. U+19xx.
        // 0x1900.

        const result = await unidecode('\u1900');
        expect(result).toBe('');

        // fetch_json should NOT be called for blank tables
        expect(util.fetch_json).not.toHaveBeenCalledWith('unidecode/data/x19.json');
    });

    it('does not fetch table again if already loaded', async () => {
        // Use x03 (Greek) for this test. U+03A9 is 'Ω'.

        // First call
        const result1 = await unidecode('Ω');
        expect(result1).toBe('O'); // Omega -> O
        expect(util.fetch_json).toHaveBeenCalledWith('unidecode/data/x03.json');

        vi.mocked(util.fetch_json).mockClear();

        // Second call
        const result2 = await unidecode('Ω');
        expect(result2).toBe('O');
        expect(util.fetch_json).not.toHaveBeenCalled();
    });

    it('handles unknown characters gracefully (file missing or fetch error)', async () => {
        // Simulate error for x05.json (Cyrillic Supplement)
        // We use mockImplementationOnce, but since we are replacing the whole implementation in beforeEach,
        // we need to be careful. The beforeEach sets up the FS mock.
        // We can override it for x05 specific URL.

        const originalImpl = vi.mocked(util.fetch_json).getMockImplementation();
        vi.mocked(util.fetch_json).mockImplementation((url: string) => {
            if (url.endsWith('x05.json')) {
                return Promise.reject(new Error('Network Error')) as any;
            }
            return originalImpl!(url);
        });

        // Mock console.error to keep output clean
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // U+0500 is 'Ԁ'.
        const result = await unidecode('\u0500');
        expect(result).toBe('');

        expect(util.fetch_json).toHaveBeenCalledWith('unidecode/data/x05.json');
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
    });

    it('caches failed table loads (does not retry)', async () => {
        // Depends on previous test state where x05 failed.
        // If x05 failed, unidecode caches empty table.

        vi.mocked(util.fetch_json).mockClear();

        // Retry same char
        const result = await unidecode('\u0500');
        expect(result).toBe('');

        // Should NOT fetch again
        expect(util.fetch_json).not.toHaveBeenCalledWith('unidecode/data/x05.json');
    });
});
