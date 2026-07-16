import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithProviders } from '../helpers/render';

let PageNativePrompter: typeof import('../../src/page/native-prompter').PageNativePrompter;

describe('PageNativePrompter', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/globals', () => ({
            BUILD_TYPE: 'www',
            get_client_type: () => 'www',
        }));
        vi.doMock('../../src/splash-util.es5', () => ({
            is_bot: () => false,
        }));
        vi.doMock('../../src/platform-utils', () => ({
            get_app_dl_link: vi.fn(() => null),
            should_show_prompt: vi.fn(() => true),
        }));

        const mod = await import('../../src/page/native-prompter');
        PageNativePrompter = mod.PageNativePrompter;
    });

    it('returns null when no prompt is set', () => {
        const { container } = renderWithProviders(<PageNativePrompter />);
        expect(container.innerHTML).toBe('');
    });
});
