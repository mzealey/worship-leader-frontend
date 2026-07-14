import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../helpers/render';

let Theme: typeof import('../../src/component/theme').Theme;
let ThemeApp: typeof import('../../src/component/theme').ThemeApp;

describe('theme', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/settings-store', () => ({
            useSetting: () => ['', vi.fn()],
        }));

        vi.doMock('../../src/globals', () => ({
            match_media_watcher: vi.fn(() => ({
                unsubscribe: vi.fn(),
                matches: false,
            })),
        }));

        const mod = await import('../../src/component/theme');
        Theme = mod.Theme;
        ThemeApp = mod.ThemeApp;
    });

    describe('Theme', () => {
        it('renders children without section prop', () => {
            renderWithProviders(
                <Theme>
                    <span data-testid="child">Hello</span>
                </Theme>,
            );

            expect(screen.getByTestId('child')).toBeInTheDocument();
        });

        it('renders children within ThemeProvider when section prop given', () => {
            renderWithProviders(
                <Theme section="Base">
                    <span data-testid="themed-child">World</span>
                </Theme>,
            );

            expect(screen.getByTestId('themed-child')).toBeInTheDocument();
        });
    });

    describe('ThemeApp', () => {
        it('renders children with theme provider', () => {
            renderWithProviders(
                <ThemeApp>
                    <span data-testid="app-child">App Content</span>
                </ThemeApp>,
            );

            expect(screen.getByTestId('app-child')).toBeInTheDocument();
        });
    });
});
