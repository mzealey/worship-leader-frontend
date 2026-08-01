import { describe, expect, it } from 'vitest';
import { useCanPrint } from '../src/can-print';

describe('useCanPrint', function () {
    it('initializes with canPrint as true', function () {
        const state = useCanPrint.getState();
        expect(state.canPrint).toBe(true);
    });

    it('set updates canPrint', function () {
        useCanPrint.getState().set(false);
        expect(useCanPrint.getState().canPrint).toBe(false);

        useCanPrint.getState().set(true);
        expect(useCanPrint.getState().canPrint).toBe(true);
    });
});
