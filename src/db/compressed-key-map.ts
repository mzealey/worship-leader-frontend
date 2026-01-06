import _COMPRESSED_KEY_MAP from '../../compressed-key-map.json';

type KeyPair = [string, string];

// Generate a lookup hash for the mapping table. It is not stored
// in a simple lookup table format so that our dump scripts can
// properly check for bad mappings.
export const COMPRESSED_KEY_MAP: Record<string, string> = {},
    DECOMPRESSED_KEY_MAP: Record<string, string> = {};
for (let i = 0; i < _COMPRESSED_KEY_MAP.length; i++) {
    const [compressed, decompressed] = _COMPRESSED_KEY_MAP[i] as KeyPair;
    DECOMPRESSED_KEY_MAP[compressed] = decompressed;
    COMPRESSED_KEY_MAP[decompressed] = compressed;
}

/**
 * Recursively decompresses an object by replacing compressed keys with their decompressed versions.
 * Uses generics to preserve the type of the input/output.
 *
 * @template T - The type of the value being decompressed
 * @param obj - The value to decompress (can be primitive, array, or object)
 * @returns The decompressed value with the same type structure as the input
 */
export function recursive_decompress<T>(obj: T): T {
    if (Array.isArray(obj)) {
        return obj.map((item) => recursive_decompress(item)) as T;
    } else if (obj && typeof obj === 'object') {
        const source = obj as Record<string, unknown>;
        const new_obj: Record<string, unknown> = {};
        for (const key in source) {
            const decompressedKey = DECOMPRESSED_KEY_MAP[key] || key;
            new_obj[decompressedKey] = recursive_decompress(source[key]);
        }
        return new_obj as T;
    }

    return obj;
}

/**
 * Conditionally decompresses an object based on the is_compressed flag.
 *
 * @template T - The type of the value being decompressed
 * @param is_compressed - Whether the object is compressed and needs decompression
 * @param obj - The value to potentially decompress
 * @returns The potentially decompressed value with the same type as the input
 */
export function maybe_recursive_decompress<T>(is_compressed: boolean, obj: T): T {
    return is_compressed ? recursive_decompress(obj) : obj;
}

/**
 * Helper to safely cast unknown values to numbers, handling both numeric and string inputs.
 * Returns undefined for invalid values.
 */
function asNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.length) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}

/**
 * Helper to safely cast unknown values to arrays.
 * Returns an empty array for non-array values.
 */
function asArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? value : [];
}

/**
 * Helper to safely cast unknown values to records (plain objects).
 * Returns undefined for non-object values.
 */
function asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

/**
 * Gets a field from an object, automatically handling key decompression if needed.
 * Supports default values for missing fields.
 *
 * @template T - The expected type of the field value
 * @param is_compressed - Whether the object uses compressed keys
 * @param obj - The object to access
 * @param key - The decompressed key name to access
 * @param defaultValue - Default value to return if the key is not found
 * @returns The value at the specified key, or the default value if not found
 */
export function get_decompressed_key<T>(is_compressed: boolean, obj: Record<string, unknown>, key: string, defaultValue: T): T;

/**
 * Gets a field from an object, automatically handling key decompression if needed.
 * Returns undefined for missing fields.
 *
 * @template T - The expected type of the field value
 * @param is_compressed - Whether the object uses compressed keys
 * @param obj - The object to access
 * @param key - The decompressed key name to access
 * @returns The value at the specified key, or undefined if not found
 */
export function get_decompressed_key<T = unknown>(is_compressed: boolean, obj: Record<string, unknown>, key: string): T | undefined;

export function get_decompressed_key<T>(is_compressed: boolean, obj: Record<string, unknown>, key: string, defaultValue?: T): T | undefined {
    const actualKey = is_compressed ? COMPRESSED_KEY_MAP[key] || key : key;
    const value = obj[actualKey];
    return value !== undefined ? (value as T) : defaultValue;
}

/**
 * Gets a numeric field from an object, with proper type coercion and default value.
 * Returns the default value if provided, otherwise undefined.
 */
export function get_number_field(is_compressed: boolean, obj: Record<string, unknown>, key: string, defaultValue: number): number;
export function get_number_field(is_compressed: boolean, obj: Record<string, unknown>, key: string): number | undefined;
export function get_number_field(is_compressed: boolean, obj: Record<string, unknown>, key: string, defaultValue?: number): number | undefined {
    const value = get_decompressed_key(is_compressed, obj, key);
    const num = asNumber(value);
    return num !== undefined ? num : defaultValue;
}

/**
 * Gets an array field from an object, with proper type coercion and optional default value.
 */
export function get_array_field<T>(is_compressed: boolean, obj: Record<string, unknown>, key: string, defaultValue: T[] = []): T[] {
    const value = get_decompressed_key(is_compressed, obj, key);
    return value !== undefined ? asArray<T>(value) : defaultValue;
}

/**
 * Gets a record (object) field from an object, with proper type coercion.
 */
export function get_record_field(is_compressed: boolean, obj: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
    const value = get_decompressed_key(is_compressed, obj, key);
    return asRecord(value);
}
