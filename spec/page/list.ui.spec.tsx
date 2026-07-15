import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithProviders } from '../helpers/render';

let PageList: typeof import('../../src/page/list').PageList;

describe('PageList', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/event-socket', () => ({
            eventSocket: {
                add_queue: vi.fn(() => vi.fn()),
                is_setup: vi.fn(() => Promise.resolve()),
                register_listener: vi.fn(),
            },
        }));

        vi.doMock('../../src/util', () => ({
            scroll_to: vi.fn(),
        }));

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/component/top-bar', () => ({
            TopBar: ({ title }: { title: string }) => <div data-testid="topbar">{title}</div>,
        }));
        vi.doMock('../../src/component/search-area', () => ({
            SearchArea: () => <div data-testid="search-area" />,
        }));
        vi.doMock('../../src/component/song-list', () => ({
            SongList: () => <div data-testid="song-list" />,
        }));

        vi.doMock('../../img/search-page-side-img.svg', () => ({ default: 'mock-img.svg' }));

        const mod = await import('../../src/page/list');
        PageList = mod.PageList;
    });

    it('renders without crashing', () => {
        renderWithProviders(<PageList />);

        expect(screen.getByTestId('topbar')).toBeInTheDocument();
        expect(screen.getByTestId('search-area')).toBeInTheDocument();
        expect(screen.getByTestId('song-list')).toBeInTheDocument();
    });

    it('renders the search icon', () => {
        const { container } = renderWithProviders(<PageList />);

        const svgIcons = container.querySelectorAll('svg');
        expect(svgIcons.length).toBeGreaterThan(0);
    });
});
