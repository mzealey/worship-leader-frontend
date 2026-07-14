import { afterEach, describe, expect, it, vi } from 'vitest';

describe('resize-watcher', function () {
    let resizeWatcherMod: typeof import('../src/resize-watcher');

    afterEach(() => {
        vi.resetModules();
    });

    it('exports send_fake_resize function', async function () {
        resizeWatcherMod = await import('../src/resize-watcher');
        expect(typeof resizeWatcherMod.send_fake_resize).toBe('function');
    });

    it('exports on_resize function', async function () {
        resizeWatcherMod = await import('../src/resize-watcher');
        expect(typeof resizeWatcherMod.on_resize).toBe('function');
    });

    it('on_resize returns a Subscription with unsubscribe method', async function () {
        resizeWatcherMod = await import('../src/resize-watcher');
        const callback = vi.fn();
        const result = resizeWatcherMod.on_resize(callback);

        expect(typeof result.unsubscribe).toBe('function');
        result.unsubscribe();
    });

    it('send_fake_resize triggers event', async function () {
        resizeWatcherMod = await import('../src/resize-watcher');
        expect(() => resizeWatcherMod.send_fake_resize()).not.toThrow();
    });
});
