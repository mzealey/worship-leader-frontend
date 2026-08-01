import { ThemeProvider, createTheme } from '@mui/material';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Themes } from '../../src/themes';
import { createSearchStoreMock } from '../helpers/mocks/db-search';
import { createEventSocketMock } from '../helpers/mocks/event-socket';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { createMetaDbMock } from '../helpers/mocks/meta-db';

const mockTheme = createTheme(Themes.light.Base);

let TagsSection: typeof import('../../src/component/tags-section').TagsSection;
let mockUpdateTagFilter: ReturnType<typeof vi.fn>;

describe('TagsSection', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        mockUpdateTagFilter = vi.fn();

        vi.doMock('../../src/event-socket', createEventSocketMock);
        vi.doMock('../../src/db-search', () => ({
            ...createSearchStoreMock({ tags: {} }),
            useSearchStore: Object.assign(
                vi.fn((selector: (state: any) => any) => {
                    if (typeof selector === 'function') {
                        return selector({ tags: {}, filters: {}, sources: {} });
                    }
                    return { tags: {}, filters: {}, sources: {} };
                }),
                {
                    getState: vi.fn(() => ({
                        tags: {},
                        filters: {},
                        sources: {},
                        setFilters: mockUpdateTagFilter,
                        updateTagFilter: mockUpdateTagFilter,
                    })),
                },
            ),
        }));
        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/meta-db', () =>
            createMetaDbMock({
                tagMappings: {
                    '1': { id: 1, tag_group: 'theme', tag_code: 'worship' },
                    '2': { id: 2, tag_group: 'theme', tag_code: 'praise' },
                },
                tags: {
                    worship: { en: 'Worship' },
                    praise: { en: 'Praise' },
                },
            }),
        );

        const mod = await import('../../src/component/tags-section');
        TagsSection = mod.TagsSection;
    });

    function renderTags(tags: number[], on_filter_change?: () => void) {
        return render(
            <ThemeProvider theme={mockTheme}>
                <TagsSection tags={tags} on_filter_change={on_filter_change} />
            </ThemeProvider>,
        );
    }

    it('returns null when tags array is empty', () => {
        renderTags([]);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders tag chips with translated labels', async () => {
        renderTags([1, 2]);

        await screen.findByRole('button', { name: 'Worship' });
        expect(screen.getByRole('button', { name: 'Praise' })).toBeInTheDocument();
    });

    it('skips tags with unknown tag codes', async () => {
        renderTags([1, 999]);

        await screen.findByRole('button', { name: 'Worship' });
        expect(screen.queryByText('unknown')).not.toBeInTheDocument();
    });

    it('calls on_filter_change when clicking a non-filtered tag', async () => {
        const user = userEvent.setup();
        const onFilterChange = vi.fn();

        renderTags([1], onFilterChange);

        const chip = await screen.findByRole('button', { name: 'Worship' });
        await user.click(chip);

        expect(mockUpdateTagFilter).toHaveBeenCalledWith({ 1: 1 });
        expect(onFilterChange).toHaveBeenCalled();
    });

    it('returns null when meta_db is not yet loaded', () => {
        vi.resetModules();
    });
});
