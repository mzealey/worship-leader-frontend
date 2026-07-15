import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithProviders } from '../helpers/render';

let PageNativePrompter: typeof import('../../src/page/native-prompter').PageNativePrompter;
let mockGlobals: { BUILD_TYPE: string; get_client_type: () => string };

describe('PageNativePrompter', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        mockGlobals = {
            BUILD_TYPE: 'www',
            get_client_type: () => 'www',
        };

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/globals', () => mockGlobals);
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

    it('renders prompt when beforeinstallprompt event fires', async () => {
        renderWithProviders(<PageNativePrompter />);

        const event = new Event('beforeinstallprompt') as any;
        event.prompt = vi.fn();
        event.preventDefault = vi.fn();
        window.dispatchEvent(event);

        await screen.findByText('native_prompt_title');
        expect(screen.getByText('native_prompt_body')).toBeInTheDocument();
        expect(screen.getByText('continue')).toBeInTheDocument();
    });

    it('calls onClose when continue button clicked', async () => {
        const onClose = vi.fn();
        renderWithProviders(<PageNativePrompter onClose={onClose} />);

        const event = new Event('beforeinstallprompt') as any;
        event.prompt = vi.fn();
        event.preventDefault = vi.fn();
        window.dispatchEvent(event);

        await screen.findByText('continue');
        const user = userEvent.setup();
        await user.click(screen.getByText('continue'));

        expect(onClose).toHaveBeenCalled();
    });

    it('renders native app link button when get_app_dl_link returns link', async () => {
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
            get_app_dl_link: vi.fn(() => ({ href: 'https://play.google.com', target: '_blank' })),
            should_show_prompt: vi.fn(() => true),
        }));

        const mod = await import('../../src/page/native-prompter');
        const PrompterWithNative = mod.PageNativePrompter;

        renderWithProviders(<PrompterWithNative />);

        await screen.findByText('native_prompt_title');
        expect(screen.getByText('native_prompt_btn')).toBeInTheDocument();
    });

    it('does not show prompt when BUILD_TYPE is not www', () => {
        mockGlobals.BUILD_TYPE = 'chrome';

        const { container } = renderWithProviders(<PageNativePrompter />);
        expect(container.innerHTML).toBe('');
    });
});
