import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithProviders } from '../helpers/render';

let SetList: typeof import('../../src/page/set-list').SetList;
let PageSetList: typeof import('../../src/page/set-list').PageSetList;
let mockSET_DB: {
    get_set_list: ReturnType<typeof vi.fn>;
};

describe('SetList', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        mockSET_DB = {
            get_set_list: vi.fn().mockResolvedValue([
                { id: 1, name: 'Set One', total: 3, ro: 0 },
                { id: 2, name: 'Set Two', total: 5, ro: 0 },
                { id: 3, name: 'Read Only Set', total: 2, ro: 1 },
            ]),
        };

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/component/router-link', () => ({
            Link: 'a',
        }));
        vi.doMock('../../src/set-db', () => ({
            SET_DB: mockSET_DB,
            on_set_db_update: {
                subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
            },
        }));
        vi.doMock('../../src/page/dialog-set-delete', () => ({
            PageSetDelete: () => <div data-testid="set-delete-dialog" />,
        }));
        vi.doMock('../../src/page/dialog-set-rename', () => ({
            PageSetRename: () => <div data-testid="set-rename-dialog" />,
        }));

        const mod = await import('../../src/page/set-list');
        SetList = mod.SetList;
        PageSetList = mod.PageSetList;
    });

    describe('SetList component', () => {
        it('renders list of sets', async () => {
            renderWithProviders(<SetList withActions divider />);

            expect(await screen.findByText('Set One')).toBeInTheDocument();
            expect(screen.getByText('Set Two')).toBeInTheDocument();
            expect(screen.getByText('Read Only Set')).toBeInTheDocument();
        });

        it('shows empty message when no sets', async () => {
            mockSET_DB.get_set_list.mockResolvedValue([]);

            const mod = await import('../../src/page/set-list');
            const LocalSetList = mod.SetList;

            renderWithProviders(<LocalSetList />);

            expect(await screen.findByText('no-sets')).toBeInTheDocument();
        });

        it('returns nothing when noEmptyText is true and no sets', async () => {
            mockSET_DB.get_set_list.mockResolvedValue([]);

            const mod = await import('../../src/page/set-list');
            const LocalSetList = mod.SetList;

            const { container } = renderWithProviders(<LocalSetList noEmptyText />);

            await vi.waitFor(() => {
                expect(container.textContent).toBe('');
            });
        });

        it('respects maxItems limit', async () => {
            renderWithProviders(<SetList maxItems={2} />);

            await screen.findByText('Set One');
            expect(screen.getByText('Set One')).toBeInTheDocument();
            expect(screen.getByText('Set Two')).toBeInTheDocument();
            expect(screen.queryByText('Read Only Set')).toBeNull();
        });
    });

    describe('PageSetList component', () => {
        it('is exported as a function', () => {
            expect(typeof PageSetList).toBe('function');
        });
    });
});
