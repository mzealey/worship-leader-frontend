import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDbMock } from '../helpers/mocks/db';
import { createSearchStoreMock } from '../helpers/mocks/db-search';
import { createEventSocketMock } from '../helpers/mocks/event-socket';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { createMetaDbMock } from '../helpers/mocks/meta-db';
import { renderWithAppTheme } from '../helpers/render';

let SearchArea: typeof import('../../src/component/search-area').SearchArea;
let mockSetFilters: ReturnType<typeof vi.fn>;
let mockUpdateSetting: ReturnType<typeof vi.fn>;

describe('SearchArea', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        mockSetFilters = vi.fn();
        mockUpdateSetting = vi.fn();

        vi.doMock('../../src/event-socket', createEventSocketMock);
        vi.doMock('../../src/db-search', () => createSearchStoreMock({ setFilters: mockSetFilters }));
        vi.doMock('../../src/settings-store', () => ({
            updateSetting: mockUpdateSetting,
            useSettingsStore: () => ({ settings: {} }),
        }));
        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/db', createDbMock);
        vi.doMock('../../src/meta-db', () => createMetaDbMock());

        const mod = await import('../../src/component/search-area');
        SearchArea = mod.SearchArea;
    });

    it('renders search input with placeholder', () => {
        renderWithAppTheme(<SearchArea />, 'Inverted');
        expect(screen.getByPlaceholderText('search_placeholder')).toBeInTheDocument();
    });

    it('shows filter dropdown when button is clicked', async () => {
        const user = userEvent.setup();
        renderWithAppTheme(<SearchArea />, 'Inverted');

        const filterButton = screen.getByTitle('more_search_options');
        await user.click(filterButton);

        await waitFor(() => {
            expect(screen.getByText('sort_default')).toBeInTheDocument();
        });
    });
});
