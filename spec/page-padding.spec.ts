import { describe, expect, it } from 'vitest';
import { usePagePadding } from '../src/page-padding';

describe('usePagePadding', function () {
    it('initializes all padding values to 0', function () {
        const state = usePagePadding.getState();
        expect(state.top).toBe(0);
        expect(state.bottom).toBe(0);
        expect(state.left).toBe(0);
        expect(state.right).toBe(0);
    });

    it('set updates specified padding values', function () {
        usePagePadding.getState().set({ top: 10, left: 20 });

        const state = usePagePadding.getState();
        expect(state.top).toBe(10);
        expect(state.left).toBe(20);
        expect(state.bottom).toBe(0);
        expect(state.right).toBe(0);
    });

    it('reset resets all values to 0', function () {
        usePagePadding.getState().set({ top: 10, bottom: 20, left: 30, right: 40 });
        usePagePadding.getState().reset();

        const state = usePagePadding.getState();
        expect(state.top).toBe(0);
        expect(state.bottom).toBe(0);
        expect(state.left).toBe(0);
        expect(state.right).toBe(0);
    });

    it('reset with partial newState sets specified values and resets others', function () {
        usePagePadding.getState().set({ top: 10, bottom: 20, left: 30, right: 40 });
        usePagePadding.getState().reset({ top: 5, left: 15 });

        const state = usePagePadding.getState();
        expect(state.top).toBe(5);
        expect(state.left).toBe(15);
        expect(state.bottom).toBe(0);
        expect(state.right).toBe(0);
    });

    it('set with empty object does not change values', function () {
        usePagePadding.getState().set({ top: 10, bottom: 20 });
        usePagePadding.getState().set({});

        const state = usePagePadding.getState();
        expect(state.top).toBe(10);
        expect(state.bottom).toBe(20);
    });
});
