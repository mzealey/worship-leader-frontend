// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as jqmUtil from '../src/jqm-util';

// Mock dependencies
vi.mock('../src/jqm-util', () => ({
    get_page_args: vi.fn(),
}));

describe('analytics', () => {
    let originalGA: any;
    let originalYM: any;
    let originalJQuery: any;

    beforeEach(() => {
        vi.resetModules();
        originalGA = (window as any).ga;
        originalYM = (window as any).ym;
        originalJQuery = (window as any).$;

        // Setup DOM mocks
        document.head.appendChild(document.createElement('script'));

        // Mock jQuery
        (window as any).$ = vi.fn().mockReturnValue({
            bind: vi.fn(),
        });

        // Setup console.log spy
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        (window as any).ga = originalGA;
        (window as any).ym = originalYM;
        (window as any).$ = originalJQuery;
        vi.restoreAllMocks();
    });

    it('does nothing if BUILD_TYPE is not www', async () => {
        vi.doMock('../src/globals', () => ({
            BUILD_TYPE: 'dev',
            DEBUG: false,
        }));

        const { maybe_setup_ga } = await import('../src/analytics');
        maybe_setup_ga();

        // Should not inject scripts
        expect((window as any).ga).toBeUndefined();
        expect((window as any).ym).toBeUndefined();
    });

    it('initializes GA and YM when BUILD_TYPE is www', async () => {
        vi.doMock('../src/globals', () => ({
            BUILD_TYPE: 'www',
            DEBUG: false,
        }));

        const { maybe_setup_ga } = await import('../src/analytics');
        maybe_setup_ga();

        expect((window as any).ga).toBeDefined();
        expect((window as any).ym).toBeDefined();

        // Verify initialization calls
        expect((window as any).ym.a).toBeDefined(); // Yandex queue
    });

    it('cleans up existing ga object', async () => {
        vi.doMock('../src/globals', () => ({
            BUILD_TYPE: 'www',
            DEBUG: false,
        }));
        (window as any).ga = 'some-garbage';

        const { maybe_setup_ga } = await import('../src/analytics');
        maybe_setup_ga();

        expect(typeof (window as any).ga).toBe('function');
    });

    describe('page tracking', () => {
        let bindCallback: (event: unknown, options: { toPage: { id: string }[] }) => void;

        beforeEach(async () => {
            vi.resetModules();

            // Capture the bind callback
            const bindMock = vi.fn((event, cb) => {
                if (event === 'pagechange') {
                    bindCallback = cb;
                }
            });
            (window as any).$ = vi.fn().mockReturnValue({ bind: bindMock });
        });

        it('tracks simple page views', async () => {
            vi.doMock('../src/globals', () => ({
                BUILD_TYPE: 'www',
                DEBUG: false,
            }));

            const { maybe_setup_ga } = await import('../src/analytics');
            maybe_setup_ga();

            // Mock GA and YM functions to track calls
            (window as any).ga = vi.fn();
            (window as any).ym = vi.fn();

            vi.mocked(jqmUtil.get_page_args).mockReturnValue({});

            const options = {
                toPage: [{ id: 'some-page' }],
            };

            if (bindCallback) bindCallback({}, options);

            expect((window as any).ga).toHaveBeenCalledWith('set', 'page', '/some-page');
            expect((window as any).ga).toHaveBeenCalledWith('send', 'pageview');
            expect((window as any).ym).toHaveBeenCalledWith(60686398, 'hit', '/some-page');
        });

        it('tracks song views with ID', async () => {
            vi.doMock('../src/globals', () => ({
                BUILD_TYPE: 'www',
                DEBUG: false,
            }));

            const { maybe_setup_ga } = await import('../src/analytics');
            maybe_setup_ga();

            // Mock GA and YM functions to track calls
            (window as any).ga = vi.fn();
            (window as any).ym = vi.fn();

            vi.mocked(jqmUtil.get_page_args).mockReturnValue({ song_id: '123' });

            const options = {
                toPage: [{ id: 'songinfo' }],
            };

            if (bindCallback) bindCallback({}, options);

            expect((window as any).ga).toHaveBeenCalledWith('set', 'page', '/songinfo/123');
            expect((window as any).ym).toHaveBeenCalledWith(60686398, 'hit', '/songinfo/123');
        });

        it('logs to console instead of sending when DEBUG is true', async () => {
            vi.doMock('../src/globals', () => ({
                BUILD_TYPE: 'www',
                DEBUG: true,
            }));

            const { maybe_setup_ga } = await import('../src/analytics');
            maybe_setup_ga();

            // Mock GA and YM functions to track calls
            (window as any).ga = vi.fn();
            (window as any).ym = vi.fn();

            vi.mocked(jqmUtil.get_page_args).mockReturnValue({});

            const options = {
                toPage: [{ id: 'some-page' }],
            };

            if (bindCallback) bindCallback({}, options);

            expect((window as any).ga).not.toHaveBeenCalled();
            expect(console.log).toHaveBeenCalledWith('sending ga for', 'some-page');
        });
    });
});
