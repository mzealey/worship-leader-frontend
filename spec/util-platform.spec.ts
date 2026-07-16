import { describe, expect, it } from 'vitest';
import { is_chrome_extension, is_cordova } from '../src/util';

describe('util platform detection', () => {
    describe('is_chrome_extension', () => {
        it('returns false when BUILD_TYPE is not chrome', () => {
            expect(is_chrome_extension()).toBe(false);
        });

        it('returns false when window.chrome.runtime.id is missing', () => {
            const origRuntime = (window as any).chrome;
            (window as any).chrome = { runtime: {} };
            expect(is_chrome_extension()).toBe(false);
            (window as any).chrome = origRuntime;
        });
    });

    describe('is_cordova', () => {
        it('returns false when BUILD_TYPE is not phonegap', () => {
            expect(is_cordova()).toBe(false);
        });
    });
});
