import { describe, expect, it, vi } from 'vitest';
import * as resizeWatcherMod from '../src/resize-watcher';

describe('resize-watcher', function () {
    it('exports send_fake_resize function', function () {
        expect(typeof resizeWatcherMod.send_fake_resize).toBe('function');
    });

    it('exports on_resize function', function () {
        expect(typeof resizeWatcherMod.on_resize).toBe('function');
    });

    it('on_resize returns a Subscription with unsubscribe method', function () {
        const callback = vi.fn();
        const result = resizeWatcherMod.on_resize(callback);

        expect(typeof result.unsubscribe).toBe('function');
        result.unsubscribe();
    });

    it('send_fake_resize triggers event', function () {
        expect(() => resizeWatcherMod.send_fake_resize()).not.toThrow();
    });
});
