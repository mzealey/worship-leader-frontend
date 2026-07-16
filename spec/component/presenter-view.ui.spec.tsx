import { beforeEach, describe, expect, it, vi } from 'vitest';

let PresenterView: typeof import('../../src/component/presenter-view').PresenterView;

describe('PresenterView', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/dual-present', () => ({
            get_presentation: vi.fn().mockRejectedValue(new Error('not available')),
            useCast: vi.fn(() => ({ supported: false, available: false, active: false })),
        }));
        vi.doMock('../../src/resize-watcher', () => ({
            on_resize: vi.fn(() => ({ unsubscribe: vi.fn() })),
        }));
        vi.doMock('../../src/persistent-storage.es5', () => ({
            persistentStorage: { get: vi.fn(), set: vi.fn() },
        }));
        vi.doMock('../../src/songxml-util', () => ({
            songxml_to_divs: vi.fn().mockReturnValue('<div>test</div>'),
        }));
        vi.doMock('../../src/util', () => ({
            is_rtl: () => false,
            is_vertical_lang: () => false,
        }));
        vi.doMock('../../src/langpack', () => ({
            useTranslation: () => ({ t: (key: string) => key }),
        }));
        vi.doMock('../../src/component/icons', () => ({}));

        const mod = await import('../../src/component/presenter-view');
        PresenterView = mod.PresenterView;
    });

    it('imports and is defined', () => {
        expect(PresenterView).toBeDefined();
    });
});
