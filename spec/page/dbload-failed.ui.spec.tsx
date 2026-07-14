import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithProviders } from '../helpers/render';

let PageDbLoadFailed: typeof import('../../src/page/dbload-failed').PageDbLoadFailed;

describe('PageDbLoadFailed', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/component/top-bar', () => ({
            TopBar: ({ title }: { title: string }) => <div data-testid="topbar">{title}</div>,
        }));

        Object.defineProperty(window, 'location', {
            writable: true,
            value: { reload: vi.fn(), href: '' },
        });

        const mod = await import('../../src/page/dbload-failed');
        PageDbLoadFailed = mod.PageDbLoadFailed;
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('renders the title', () => {
        renderWithProviders(<PageDbLoadFailed />);
        const titles = screen.getAllByText('dbload-failed-title');
        expect(titles.length).toBe(2); // in TopBar and Typography
    });

    it('renders the retry button', () => {
        renderWithProviders(<PageDbLoadFailed />);
        expect(screen.getByText('retry')).toBeInTheDocument();
    });

    it('reloads page when retry is clicked', async () => {
        const user = userEvent.setup();
        renderWithProviders(<PageDbLoadFailed />);

        await user.click(screen.getByText('retry'));

        expect(window.location.reload).toHaveBeenCalled();
    });
});
