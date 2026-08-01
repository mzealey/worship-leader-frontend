import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let PresenterView: typeof import('../../src/component/presenter-view').PresenterView;

describe('PresenterView', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/dual-present', () => ({
            get_presentation: vi.fn().mockResolvedValue({
                send_msg: vi.fn(),
                exit_cast_mode: vi.fn(),
                is_casting: () => false,
                enter_cast_mode: vi.fn(),
                subject: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
                is_dual: false,
            }),
            useCast: vi.fn((selector: (s: any) => any) =>
                selector({
                    supported: false,
                    available: false,
                    active: false,
                }),
            ),
        }));
        vi.doMock('../../src/persistent-storage.es5', () => ({
            persistentStorage: {
                get: vi.fn(),
                set: vi.fn(),
                getObj: vi.fn(() => 0),
                setObj: vi.fn(),
            },
        }));
        vi.doMock('../../src/resize-watcher', () => ({
            on_resize: vi.fn(() => ({ unsubscribe: vi.fn() })),
        }));
        vi.doMock('../../src/songxml-util', () => ({
            songxml_to_divs: vi.fn().mockReturnValue('<div>songxml content</div>'),
            format_html_chords: vi.fn(),
        }));
        vi.doMock('../../src/util', () => ({
            is_rtl: () => false,
            is_vertical_lang: () => false,
        }));
        vi.doMock('../../src/component/icons', () => ({
            ZoomIn: () => <svg data-testid="icon-zoom-in" />,
            ZoomOut: () => <svg data-testid="icon-zoom-out" />,
            BlankScreen: () => <svg data-testid="icon-blank" />,
            UnblankScreen: () => <svg data-testid="icon-unblank" />,
            ExitPresent: () => <svg data-testid="icon-exit" />,
            ScrollUp: () => <svg data-testid="icon-scroll-up" />,
            ScrollDown: () => <svg data-testid="icon-scroll-down" />,
            ScrollLeft: () => <svg data-testid="icon-scroll-left" />,
            ScrollRight: () => <svg data-testid="icon-scroll-right" />,
            PresentFullScreen: () => <svg data-testid="icon-fullscreen" />,
            PresentZoomIn: () => <svg data-testid="icon-zoom-in" />,
            PresentZoomOut: () => <svg data-testid="icon-zoom-out" />,
            PresentBlank: () => <svg data-testid="icon-blank" />,
            PresentUnBlank: () => <svg data-testid="icon-unblank" />,
        }));

        const mod = await import('../../src/component/presenter-view');
        PresenterView = mod.PresenterView;
    });

    it('returns null when cast not active', () => {
        const song = { id: 1, title: 'Test', lang: 'en', songxml: '<song/>' } as any;
        const { container } = render(<PresenterView song={song} />);
        expect(container.textContent).toBe('');
    });
});
