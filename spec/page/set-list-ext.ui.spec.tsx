import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithRouter } from '../helpers/render';

let SetList: typeof import('../../src/page/set-list').SetList;

describe('SetList', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/set-db', () => ({
            SET_DB: {
                get_set_list: vi.fn().mockResolvedValue([
                    { id: 1, name: 'Set One', total: 5, ro: 0 },
                    { id: 2, name: 'Set Two', total: 3, ro: 1 },
                ]),
            },
            on_set_db_update: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
        }));
        vi.doMock('../../src/component/top-bar', () => ({
            TopBar: ({ title }: any) => <div data-testid="topbar">{title}</div>,
        }));
        vi.doMock('../../src/page/dialog-set-delete', () => ({
            PageSetDelete: () => <div data-testid="delete-dialog" />,
        }));
        vi.doMock('../../src/page/dialog-set-rename', () => ({
            PageSetRename: () => <div data-testid="rename-dialog" />,
        }));
        vi.doMock('../../src/component/router-link', () => ({
            Link: ({ to, children, ...props }: any) => (
                <a href={to} {...props}>
                    {children}
                </a>
            ),
        }));

        const mod = await import('../../src/page/set-list');
        SetList = mod.SetList;
    });

    it('renders set names', async () => {
        renderWithRouter(<SetList />);

        await screen.findByText('Set One');
        expect(screen.getByText('Set Two')).toBeInTheDocument();
    });

    it('shows no-sets text when empty', async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/set-db', () => ({
            SET_DB: { get_set_list: vi.fn().mockResolvedValue([]) },
            on_set_db_update: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
        }));
        vi.doMock('../../src/component/top-bar', () => ({
            TopBar: ({ title }: any) => <div data-testid="topbar">{title}</div>,
        }));
        vi.doMock('../../src/page/dialog-set-delete', () => ({
            PageSetDelete: () => <div data-testid="delete-dialog" />,
        }));
        vi.doMock('../../src/page/dialog-set-rename', () => ({
            PageSetRename: () => <div data-testid="rename-dialog" />,
        }));
        vi.doMock('../../src/component/router-link', () => ({
            Link: ({ to, children, ...props }: any) => (
                <a href={to} {...props}>
                    {children}
                </a>
            ),
        }));

        const mod2 = await import('../../src/page/set-list');
        const EmptySetList = mod2.SetList;

        renderWithRouter(<EmptySetList />);
        await screen.findByText('no-sets');
    });

    it('hides no-sets text when noEmptyText is true', async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/set-db', () => ({
            SET_DB: { get_set_list: vi.fn().mockResolvedValue([]) },
            on_set_db_update: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
        }));
        vi.doMock('../../src/component/top-bar', () => ({
            TopBar: ({ title }: any) => <div data-testid="topbar">{title}</div>,
        }));
        vi.doMock('../../src/page/dialog-set-delete', () => ({
            PageSetDelete: () => <div data-testid="delete-dialog" />,
        }));
        vi.doMock('../../src/page/dialog-set-rename', () => ({
            PageSetRename: () => <div data-testid="rename-dialog" />,
        }));
        vi.doMock('../../src/component/router-link', () => ({
            Link: ({ to, children, ...props }: any) => (
                <a href={to} {...props}>
                    {children}
                </a>
            ),
        }));

        const mod3 = await import('../../src/page/set-list');
        const HiddenEmptyList = mod3.SetList;

        const { container } = renderWithRouter(<HiddenEmptyList noEmptyText />);
        expect(container.querySelector('p')).not.toBeInTheDocument();
    });
});
