// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

// We need to import the file to trigger the code
// Since it has side effects (assigning to window), we should probably import it dynamically or ensure mocks are set up first.

describe('common-functions', () => {
    // Mock imports
    vi.mock('../src/globals', () => ({
        get_host: vi.fn().mockReturnValue('http://test.host'),
    }));

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
