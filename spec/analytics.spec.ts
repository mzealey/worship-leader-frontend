// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { maybe_setup_ga } from '../src/analytics';
import * as jqmUtil from '../src/jqm-util';

// Mock dependencies
vi.mock('../src/jqm-util', () => ({
    get_page_args: vi.fn(),
}));

describe('analytics', () => {
    let originalBuildType: any;
    let originalGA: any;
    let originalYM: any;
    let originalJQuery: any;
    let originalDebug: any;

    beforeEach(() => {
        vi.resetModules();
        originalBuildType = (globalThis as any).BUILD_TYPE;
        originalDebug = (globalThis as any).DEBUG;
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
        (globalThis as any).BUILD_TYPE = originalBuildType;
        (globalThis as any).DEBUG = originalDebug;
        (window as any).ga = originalGA;
        (window as any).ym = originalYM;
        (window as any).$ = originalJQuery;
        vi.restoreAllMocks();
    });

    it('does nothing if BUILD_TYPE is not www', () => {
        (globalThis as any).BUILD_TYPE = 'dev';
        maybe_setup_ga();

        // Should not inject scripts
        expect((window as any).ga).toBeUndefined();
        expect((window as any).ym).toBeUndefined();
    });

    it('initializes GA and YM when BUILD_TYPE is www', () => {
        (globalThis as any).BUILD_TYPE = 'www';

        maybe_setup_ga();

        expect((window as any).ga).toBeDefined();
        expect((window as any).ym).toBeDefined();

        // Verify initialization calls
        expect((window as any).ym.a).toBeDefined(); // Yandex queue
    });

    it('cleans up existing ga object', () => {
        (globalThis as any).BUILD_TYPE = 'www';
        (window as any).ga = 'some-garbage';

        maybe_setup_ga();

        expect(typeof (window as any).ga).toBe('function');
    });

    describe('page tracking', () => {
        let bindCallback: (event: unknown, options: { toPage: { id: string }[] }) => void;

        beforeEach(() => {
            (globalThis as any).BUILD_TYPE = 'www';
            (globalThis as any).DEBUG = false;

            // Capture the bind callback
            const bindMock = vi.fn((event, cb) => {
                if (event === 'pagechange') {
                    bindCallback = cb;
                }
            });
            (window as any).$ = vi.fn().mockReturnValue({ bind: bindMock });

            maybe_setup_ga();

            // Mock GA and YM functions to track calls
            (window as any).ga = vi.fn();
            (window as any).ym = vi.fn();
        });

        it('tracks simple page views', () => {
            vi.mocked(jqmUtil.get_page_args).mockReturnValue({});

            const options = {
                toPage: [{ id: 'some-page' }],
            };

            if (bindCallback) bindCallback({}, options);

            expect((window as any).ga).toHaveBeenCalledWith('set', 'page', '/some-page');
            expect((window as any).ga).toHaveBeenCalledWith('send', 'pageview');
            expect((window as any).ym).toHaveBeenCalledWith(60686398, 'hit', '/some-page');
        });

        it('tracks song views with ID', () => {
            vi.mocked(jqmUtil.get_page_args).mockReturnValue({ song_id: '123' });

            const options = {
                toPage: [{ id: 'songinfo' }],
            };

            if (bindCallback) bindCallback({}, options);

            expect((window as any).ga).toHaveBeenCalledWith('set', 'page', '/songinfo/123');
            expect((window as any).ym).toHaveBeenCalledWith(60686398, 'hit', '/songinfo/123');
        });

        it('logs to console instead of sending when DEBUG is true', () => {
            (globalThis as any).DEBUG = true;
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
