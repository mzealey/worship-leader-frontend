// @vitest-environment jsdom
import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { get_decompressed_key, recursive_decompress } from '../src/db/compressed-key-map';

// Read the fixture file
const dbPath = path.resolve(__dirname, 'fixtures/db.en.json');
const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

describe('compressed-key-map', () => {
    describe('recursive_decompress', () => {
        it('decompresses a song object from the fixture', () => {
            const compressedSong = dbData.data[0];
            const decompressedSong = recursive_decompress(compressedSong);

            // Check for expected keys based on compressed-key-map.json
            // o -> is_original
            expect(decompressedSong).toHaveProperty('is_original');
            expect(decompressedSong.is_original).toBe(compressedSong.o);

            // l -> lang
            expect(decompressedSong).toHaveProperty('lang');
            expect(decompressedSong.lang).toBe(compressedSong.l);

            // i -> id
            expect(decompressedSong).toHaveProperty('id');
            expect(decompressedSong.id).toBe(compressedSong.i);

            // x -> songxml
            expect(decompressedSong).toHaveProperty('songxml');
            expect(decompressedSong.songxml).toBe(compressedSong.x);

            // 8 -> title
            expect(decompressedSong).toHaveProperty('title');
            expect(decompressedSong.title).toBe(compressedSong['8']);

            // Verify compressed keys are gone (optional, but typical for replacement)
            // The implementation creates a NEW object with decompressed keys.
            // It does NOT delete old keys if they were not in the map?
            // Actually the implementation loops over keys and looks up mapping.
            // If mapping exists, use it. If not, use original key.
            // So if 'o' maps to 'is_original', the new object has 'is_original'. 'o' is not added unless 'o' maps to 'o'.
            expect(decompressedSong).not.toHaveProperty('o');
        });

        it('handles arrays', () => {
            const input = [{ o: 1 }, { o: 0 }];
            const output = recursive_decompress(input);
            expect(output).toHaveLength(2);
            expect((output[0] as any).is_original).toBe(1);
            expect((output[1] as any).is_original).toBe(0);
        });

        it('handles nested objects', () => {
            // '6' -> sources
            // Inside sources, 'i' -> id
            // Example from fixture: "6":[{"i":"134"}]
            const compressedSong = dbData.data[0];
            expect(compressedSong).toHaveProperty('6');

            const decompressedSong = recursive_decompress(compressedSong);
            expect(decompressedSong).toHaveProperty('sources');
            expect(Array.isArray(decompressedSong.sources)).toBe(true);
            expect(decompressedSong.sources[0]).toHaveProperty('id');
            expect(decompressedSong.sources[0].id).toBe(compressedSong['6'][0].i);
        });

        it('leaves unknown keys as is', () => {
            const input = { unknown_key: 123, o: 1 };
            const output = recursive_decompress(input) as any;
            expect(output.unknown_key).toBe(123);
            expect(output.is_original).toBe(1);
        });
    });

    describe('get_decompressed_key', () => {
        it('retrieves value using decompressed key name from compressed object', () => {
            const obj = { o: 1, l: 'en' };
            // We want to get 'is_original'. The function looks up 'is_original' in COMPRESSED_KEY_MAP
            // COMPRESSED_KEY_MAP['is_original'] should be 'o'.
            // So it looks for obj['o'].

            const val = get_decompressed_key(true, obj, 'is_original');
            expect(val).toBe(1);
        });

        it('retrieves value using key name from uncompressed object', () => {
            const obj = { is_original: 1 };
            const val = get_decompressed_key(false, obj, 'is_original');
            expect(val).toBe(1);
        });

        it('returns default value if missing', () => {
            const obj = { o: 1 };
            const val = get_decompressed_key(true, obj, 'title', 'Default Title');
            expect(val).toBe('Default Title');
        });

        it('handles keys that are not in the map', () => {
            const obj = { custom: 'value' };
            const val = get_decompressed_key(true, obj, 'custom');
            expect(val).toBe('value');
        });
    });
});
