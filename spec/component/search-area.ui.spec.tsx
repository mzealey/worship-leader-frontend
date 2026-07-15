import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithAppTheme } from '../helpers/render';

let SearchArea: typeof import('../../src/component/search-area').SearchArea;

describe('SearchArea', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        const storeState = {
            filters: { search: '', order_by: 'default', lang: 'all' },
            sources: {},
            tags: {},
        };

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/globals', () => ({
            DEBUG: false,
        }));
        vi.doMock('../../src/splash-util.es5', () => ({
            parse_search: vi.fn(),
        }));
        vi.doMock('../../src/settings-store', () => ({
            updateSetting: vi.fn(),
        }));
        vi.doMock('../../src/set', () => ({
            create_set_from_url: vi.fn(),
        }));
        vi.doMock('../../src/component/search-filters', () => ({
            SearchFilters: () => <div data-testid="search-filters" />,
        }));
        vi.doMock('../../src/db/common', () => ({
            get_db_chosen_langs: () => [],
        }));
        vi.doMock('../../src/db-search', () => ({
            useSearchStore: Object.assign(
                (selector: (s: typeof storeState) => unknown) => selector(storeState),
                {
                    getState: () => storeState,
                    subscribe: vi.fn(() => vi.fn()),
                },
            ),
        }));

        const mod = await import('../../src/component/search-area');
        SearchArea = mod.SearchArea;
    });

    it('renders search input without crashing', () => {
        renderWithAppTheme(<SearchArea />);

        expect(screen.getByTitle('search_placeholder')).toBeInTheDocument();
    });

    it('toggles search filters dropdown', async () => {
        renderWithAppTheme(<SearchArea />);

        const toggleBtn = screen.getByTitle('more_search_options');
        const user = userEvent.setup();
        await user.click(toggleBtn);

        expect(screen.getByTestId('search-filters')).toBeInTheDocument();
    });

    it('renders search icon', () => {
        const { container } = renderWithAppTheme(<SearchArea />);

        const svgIcons = container.querySelectorAll('svg');
        expect(svgIcons.length).toBeGreaterThan(0);
    });
});
