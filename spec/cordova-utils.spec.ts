// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as cordovaUtils from '../src/cordova-utils';

describe('cordova-utils module', function () {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('imports without throwing', async function () {
        await expect(import('../src/cordova-utils')).resolves.toBeDefined();
    });

    it('exports statusbar function', async function () {
        expect(typeof cordovaUtils.statusbar).toBe('function');
    });

    it('statusbar function can be called without throwing', async function () {
        expect(() => {
            cordovaUtils.statusbar('hide');
        }).not.toThrow();
    });
});
