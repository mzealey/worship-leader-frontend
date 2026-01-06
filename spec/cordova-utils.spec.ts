// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('cordova-utils module', function () {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('imports without throwing', async function () {
        await expect(import('../src/cordova-utils')).resolves.toBeDefined();
    });

    it('exports statusbar function', async function () {
        const module = await import('../src/cordova-utils');
        expect(typeof module.statusbar).toBe('function');
    });

    it('statusbar function can be called without throwing', async function () {
        const module = await import('../src/cordova-utils');

        expect(() => {
            module.statusbar('hide');
        }).not.toThrow();
    });
});
