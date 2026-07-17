import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithProviders } from '../helpers/render';

let TopBar: typeof import('../../src/component/top-bar').TopBar;

describe('TopBar', () => {
    const originalTitle = document.title;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);

        const mod = await import('../../src/component/top-bar');
        TopBar = mod.TopBar;

        document.title = originalTitle;
    });

    it('renders with string title', () => {
        renderWithProviders(<TopBar title="My Page" />);

        expect(screen.getByText('My Page')).toBeInTheDocument();
    });

    it('sets document title from string title', () => {
        renderWithProviders(<TopBar title="Settings" />);

        expect(document.title).toContain('Worship Leader');
        expect(document.title).toContain('Settings');
    });

    it('uses documentTitle prop over title for document.title', () => {
        renderWithProviders(<TopBar title="Page Title" documentTitle="Custom Doc Title" />);

        expect(document.title).toContain('Custom Doc Title');
        expect(document.title).toContain('Worship Leader');
    });

    it('shows only app name when no title provided', () => {
        renderWithProviders(<TopBar />);

        expect(document.title).toContain('Worship Leader');
    });

    it('renders children inside toolbar', () => {
        renderWithProviders(
            <TopBar title="Test">
                <button data-testid="child-btn">Click</button>
            </TopBar>,
        );

        expect(screen.getByTestId('child-btn')).toBeInTheDocument();
    });

    it('renders before element', () => {
        renderWithProviders(<TopBar before={<span data-testid="before-el">Before</span>} />);

        expect(screen.getByTestId('before-el')).toBeInTheDocument();
    });

    it('renders menu button when children or menuOnly provided', () => {
        renderWithProviders(
            <TopBar>
                <button data-testid="menu-item">Menu Item</button>
            </TopBar>,
        );

        expect(screen.getByTestId('menu-item')).toBeInTheDocument();
    });

    it('does not render menu button when noMenu is true', () => {
        renderWithProviders(
            <TopBar noMenu>
                <button>Should not be in menu</button>
            </TopBar>,
        );

        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBe(1);
    });

    it('renders menu button when menuOnly is provided', () => {
        renderWithProviders(<TopBar menuOnly={<span data-testid="menu-only">Menu Only Item</span>} />);

        const menuButton = document.querySelector('.MuiIconButton-root');
        expect(menuButton).toBeInTheDocument();
    });

    it('renders nothing when no content provided', () => {
        const { container } = renderWithProviders(<TopBar noMenu noSpacer />);

        expect(container.querySelector('.MuiAppBar-root')).not.toBeInTheDocument();
    });

    it('renders without spacer when noSpacer is true', () => {
        renderWithProviders(<TopBar title="Test" noSpacer />);

        expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('applies className to AppBar', () => {
        const { container } = renderWithProviders(<TopBar title="Test" className="custom-class" />);

        const appBar = container.querySelector('.MuiAppBar-root');
        expect(appBar?.className).toContain('custom-class');
    });

    it('sets document title from non-string title using documentTitle', () => {
        renderWithProviders(<TopBar title={<span>JSX Title</span>} documentTitle="JSX Page" />);

        expect(document.title).toContain('JSX Page');
        expect(document.title).toContain('Worship Leader');
    });
});
