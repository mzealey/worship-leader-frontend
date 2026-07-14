import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithProviders } from '../helpers/render';

let PageFirsttimeWelcome: typeof import('../../src/page/firsttime-welcome').PageFirsttimeWelcome;

describe('PageFirsttimeWelcome', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/component/top-bar', () => ({
            TopBar: ({ title }: { title: string }) => <div data-testid="topbar">{title}</div>,
        }));

        const mod = await import('../../src/page/firsttime-welcome');
        PageFirsttimeWelcome = mod.PageFirsttimeWelcome;
    });

    it('renders welcome message', () => {
        renderWithProviders(<PageFirsttimeWelcome onComplete={() => {}} />);

        expect(screen.getByText('firsttime_welcome')).toBeInTheDocument();
        expect(screen.getByText('choose_lang_msg')).toBeInTheDocument();
    });

    it('renders continue button', () => {
        renderWithProviders(<PageFirsttimeWelcome onComplete={() => {}} />);

        expect(screen.getByText('continue')).toBeInTheDocument();
    });

    it('calls onComplete when continue is clicked', async () => {
        const user = (await import('@testing-library/user-event')).default;
        const usr = user.setup();
        const onComplete = vi.fn();

        renderWithProviders(<PageFirsttimeWelcome onComplete={onComplete} />);

        await usr.click(screen.getByText('continue'));

        expect(onComplete).toHaveBeenCalled();
    });

    it('renders language chooser', () => {
        renderWithProviders(<PageFirsttimeWelcome onComplete={() => {}} />);

        const select = document.querySelector('select');
        expect(select).toBeInTheDocument();
    });
});
