import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithProviders } from '../helpers/render';

let LockScreen: typeof import('../../src/component/lock-screen').LockScreen;
let Spinner: typeof import('../../src/component/lock-screen').Spinner;

describe('lock-screen', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);

        const mod = await import('../../src/component/lock-screen');
        LockScreen = mod.LockScreen;
        Spinner = mod.Spinner;
    });

    describe('Spinner', () => {
        it('renders CircularProgress', () => {
            renderWithProviders(<Spinner />);

            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });

        it('renders message when message_code is provided', () => {
            renderWithProviders(<Spinner message_code="loading_message" />);

            expect(screen.getByText('loading_message')).toBeInTheDocument();
            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });

        it('does not render message heading when no message_code', () => {
            renderWithProviders(<Spinner />);

            expect(screen.queryByRole('heading')).not.toBeInTheDocument();
        });
    });

    describe('LockScreen', () => {
        it('renders inside a Modal that is open', () => {
            renderWithProviders(<LockScreen />);

            expect(screen.getByRole('progressbar')).toBeInTheDocument();
            // Modal should be present
            expect(document.querySelector('.MuiModal-root')).toBeInTheDocument();
        });

        it('passes message_code to Spinner', () => {
            renderWithProviders(<LockScreen message_code="loading_data" />);

            expect(screen.getByText('loading_data')).toBeInTheDocument();
        });
    });
});
