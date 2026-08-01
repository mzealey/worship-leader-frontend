import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

        expect(
            screen.getByText(
                'Welcome to Worship Leader. On each page there will be a short help message appearing at the bottom of your screen. To see the full help, touch the message. To turn these messages off, go to the settings page.',
            ),
        ).toBeInTheDocument();
        expect(screen.getByText('Below, you can choose the language you would like to use the app in.')).toBeInTheDocument();
    });

    it('renders continue button', () => {
        renderWithProviders(<PageFirsttimeWelcome onComplete={() => {}} />);

        expect(screen.getByText('Continue')).toBeInTheDocument();
    });

    it('calls onComplete when continue is clicked', async () => {
        const usr = userEvent.setup();
        const onComplete = vi.fn();

        renderWithProviders(<PageFirsttimeWelcome onComplete={onComplete} />);

        await usr.click(screen.getByText('Continue'));

        expect(onComplete).toHaveBeenCalled();
    });

    it('renders language chooser', () => {
        renderWithProviders(<PageFirsttimeWelcome onComplete={() => {}} />);

        const select = document.querySelector('select');
        expect(select).toBeInTheDocument();
    });
});
