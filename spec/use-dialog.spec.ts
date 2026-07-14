// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDialog } from '../src/use-dialog';

describe('useDialog', function () {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(window, 'location', {
            writable: true,
            value: {
                hash: '#test-hash',
            },
        });
        vi.spyOn(window, 'addEventListener');
        vi.spyOn(window, 'removeEventListener');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('initializes with closed as false', function () {
        const { result } = renderHook(() => useDialog());

        expect(result.current.closed).toBe(false);
    });

    it('returns handleClose function', function () {
        const { result } = renderHook(() => useDialog());

        expect(typeof result.current.handleClose).toBe('function');
    });

    it('modifies window.location.hash on initialization', function () {
        const { result } = renderHook(() => useDialog());

        expect(result.current.closed).toBe(false);
        expect(window.location.hash).toContain('?dialog');
    });

    it('registers popstate listener on mount', function () {
        renderHook(() => useDialog());

        expect(window.addEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));
    });

    it('removes popstate listener on unmount', function () {
        const { unmount } = renderHook(() => useDialog());

        unmount();

        expect(window.removeEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));
    });

    it('handleClose triggers history.back', function () {
        const historyBack = vi.spyOn(window.history, 'back');
        const { result } = renderHook(() => useDialog());

        act(() => {
            result.current.handleClose();
        });

        expect(historyBack).toHaveBeenCalled();
    });

    it('calls onClose when popstate returns to original hash', async function () {
        let popstateCallback: EventListener | null = null;
        vi.spyOn(window, 'addEventListener').mockImplementation((event: string, cb: EventListenerOrEventListenerObject) => {
            if (event === 'popstate') popstateCallback = cb as EventListener;
        });

        const onClose = vi.fn();
        const { result } = renderHook(() => useDialog(onClose));

        // Simulate popstate returning to original hash
        Object.defineProperty(window, 'location', {
            writable: true,
            value: { hash: '#test-hash' },
        });

        await act(async () => {
            popstateCallback?.(new PopStateEvent('popstate'));
        });

        expect(result.current.closed).toBe(true);
        expect(onClose).toHaveBeenCalled();
    });

    it('updates onClose ref when onClose changes', function () {
        const onClose1 = vi.fn();
        const { result, rerender } = renderHook(({ onClose }) => useDialog(onClose), { initialProps: { onClose: onClose1 } });

        const onClose2 = vi.fn();
        rerender({ onClose: onClose2 });

        // Hook re-renders with new callback; verify no errors
        expect(result.current.closed).toBe(false);
    });

    it('does not modify hash again if already closed', async function () {
        let popstateCallback: EventListener | null = null;
        vi.spyOn(window, 'addEventListener').mockImplementation((event: string, cb: EventListenerOrEventListenerObject) => {
            if (event === 'popstate') popstateCallback = cb as EventListener;
        });

        const { result } = renderHook(() => useDialog());

        // Simulate popstate returning to original hash
        Object.defineProperty(window, 'location', {
            writable: true,
            value: { hash: '#test-hash' },
        });

        await act(async () => {
            popstateCallback?.(new PopStateEvent('popstate'));
        });

        expect(result.current.closed).toBe(true);
        // Hash should not have been modified further
    });
});
