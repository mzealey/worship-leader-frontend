// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/globals', () => ({
    API_HOST: 'http://test.host',
    BUILD_TYPE: 'editor',
}));

describe('common-functions', () => {
    it('exports functions to window', async () => {
        // Dynamic import to run the side effects
        await import('../src/common-functions');

        expect((window as any).HOST).toBe('http://test.host');
    });

    it('extends String.prototype.format', async () => {
        await import('../src/common-functions');

        // Typescript might complain about format not existing on String
        const str = 'test {0}';
        const result = (str as any).format('arg1');

        expect(result).toBe('test arg1');
    });
});
