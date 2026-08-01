// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../src/common-functions';

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
        expect((window as any).HOST).toBe('http://test.host');
    });

    it('extends String.prototype.format', async () => {
        const str = 'test {0}';
        const result = (str as any).format('arg1');

        expect(result).toBe('test arg1');
    });
});
