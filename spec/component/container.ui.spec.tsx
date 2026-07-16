import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithRouter } from '../helpers/render';

let PagesContainer: typeof import('../../src/component/container').PagesContainer;

describe('PagesContainer', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/globals', () => ({
            match_media_watcher: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
            get_client_type: () => 'www',
            BUILD_TYPE: 'www',
        }));
        vi.doMock('../../src/page-padding', () => {
            const store = { top: 0, bottom: 0, reset: vi.fn() };
            const fn = Object.assign(
                vi.fn((selector: (s: any) => any) => selector(store)),
                { reset: store.reset },
            );
            return { usePagePadding: fn };
        });
        vi.doMock('../../src/component/theme', () => ({
            Theme: ({ children, section }: { children: React.ReactNode; section: string }) => <div data-testid={`theme-${section}`}>{children}</div>,
        }));
        vi.doMock('../../src/component/router-link', () => ({
            Link: ({ to, children, ...props }: any) => (
                <a href={to} {...props}>
                    {children}
                </a>
            ),
        }));
        vi.doMock('../../src/page/edit', () => ({
            PageEditTextarea: () => <div data-testid="page-edit" />,
        }));

        const mod = await import('../../src/component/container');
        PagesContainer = mod.PagesContainer;
    });

    it('renders without crashing', () => {
        renderWithRouter(<PagesContainer />);
        expect(document.body).toBeInTheDocument();
    });

    it('renders bottom nav in mobile mode', () => {
        renderWithRouter(<PagesContainer />);
        expect(screen.getByTestId('theme-Bottom')).toBeInTheDocument();
    });

    it('renders children content', () => {
        renderWithRouter(
            <PagesContainer>
                <div data-testid="child-content">Hello</div>
            </PagesContainer>,
        );
        expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });
});
