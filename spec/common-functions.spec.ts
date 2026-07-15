// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/globals', () => ({
    API_HOST: 'http://test.host',
    BUILD_TYPE: 'editor',
}));

describe('common-functions', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('exports functions to window', async () => {
        await import('../src/common-functions');

        expect((window as any).HOST).toBe('http://test.host');
    });

    it('extends String.prototype.format', async () => {
        await import('../src/common-functions');

        const str = 'test {0}';
        const result = (str as any).format('arg1');

        expect(result).toBe('test arg1');
    });
});
