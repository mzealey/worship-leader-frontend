import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handlePrint } from '../src/print-util';

describe('handlePrint', function () {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.resetModules();
    });

    describe('standard window.print path', function () {
        it('calls window.print when no cordova', function () {
            vi.spyOn(window, 'print').mockImplementation(vi.fn());

            handlePrint();

            expect(window.print).toHaveBeenCalled();
        });

        it('calls onAfterPrint after printing', function () {
            vi.spyOn(window, 'print').mockImplementation(vi.fn());
            const onAfterPrint = vi.fn();

            handlePrint(onAfterPrint);

            expect(window.print).toHaveBeenCalled();
            expect(onAfterPrint).toHaveBeenCalled();
        });

        it('handles print throwing an error gracefully', function () {
            vi.spyOn(window, 'print').mockImplementation(() => {
                throw new Error('print error');
            });
            const onAfterPrint = vi.fn();

            expect(() => handlePrint(onAfterPrint)).not.toThrow();
            expect(onAfterPrint).not.toHaveBeenCalled();
        });

        it('uses setTimeout when prepareForPrint returns true', function () {
            vi.spyOn(window, 'print').mockImplementation(vi.fn());
            vi.useFakeTimers();
            const prepareForPrint = vi.fn().mockReturnValue(true);

            handlePrint(undefined, prepareForPrint);

            expect(window.print).not.toHaveBeenCalled();
            vi.runAllTimers();
            expect(window.print).toHaveBeenCalled();
            vi.useRealTimers();
        });

        it('calls print immediately when prepareForPrint returns false', function () {
            vi.spyOn(window, 'print').mockImplementation(vi.fn());
            const prepareForPrint = vi.fn().mockReturnValue(false);

            handlePrint(undefined, prepareForPrint);

            expect(window.print).toHaveBeenCalled();
        });

        it('calls print immediately when no prepareForPrint', function () {
            vi.spyOn(window, 'print').mockImplementation(vi.fn());

            handlePrint(undefined, undefined);

            expect(window.print).toHaveBeenCalled();
        });
    });

    describe('cordova path', function () {
        let originalCordova: any;

        beforeEach(() => {
            originalCordova = (window as any).cordova;
            vi.doMock('../src/util', () => ({
                is_cordova: () => true,
            }));
        });

        afterEach(() => {
            (window as any).cordova = originalCordova;
            vi.resetModules();
        });

        it('uses cordova printer plugin when available', async function () {
            const printerPrint = vi.fn();
            (window as any).cordova = {
                plugins: {
                    printer: {
                        print: printerPrint,
                    },
                },
            };

            const { handlePrint: hp } = await import('../src/print-util');

            hp();

            expect(printerPrint).toHaveBeenCalledWith('', {}, expect.any(Function));
        });

        it('calls onAfterPrint when cordova print succeeds', async function () {
            let printCallback: (res: boolean) => void = () => {};
            const printerPrint = vi.fn().mockImplementation((_a: any, _b: any, cb: (res: boolean) => void) => {
                printCallback = cb;
            });
            (window as any).cordova = {
                plugins: {
                    printer: {
                        print: printerPrint,
                    },
                },
            };

            const { handlePrint: hp } = await import('../src/print-util');
            const onAfterPrint = vi.fn();

            hp(onAfterPrint);

            printCallback(true);
            expect(onAfterPrint).toHaveBeenCalled();
        });

        it('does not call onAfterPrint when cordova print fails', async function () {
            let printCallback: (res: boolean) => void = () => {};
            const printerPrint = vi.fn().mockImplementation((_a: any, _b: any, cb: (res: boolean) => void) => {
                printCallback = cb;
            });
            (window as any).cordova = {
                plugins: {
                    printer: {
                        print: printerPrint,
                    },
                },
            };

            const { handlePrint: hp } = await import('../src/print-util');
            const onAfterPrint = vi.fn();

            hp(onAfterPrint);

            printCallback(false);
            expect(onAfterPrint).not.toHaveBeenCalled();
        });
    });
});
