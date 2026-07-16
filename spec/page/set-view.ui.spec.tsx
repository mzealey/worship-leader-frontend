import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithRouter } from '../helpers/render';

let PageSetView: typeof import('../../src/page/set-view').PageSetView;

describe('PageSetView', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/db', () => ({
            DB: Promise.resolve({
                get_songs: vi.fn().mockResolvedValue([]),
            }),
            DB_AVAILABLE: Promise.resolve({}),
        }));
        vi.doMock('../../src/set-db', () => ({
            SET_DB: {
                get_songs: vi.fn(() => []),
                get_set: vi.fn().mockResolvedValue({
                    id: 1,
                    name: 'My Set',
                    songs: [],
                    ro: 0,
                    uuid: 'set-uuid',
                    total_songs: 0,
                }),
                remove_song_from_set: vi.fn().mockResolvedValue(undefined),
                reorder_set_songs: vi.fn().mockResolvedValue(undefined),
            },
            on_set_db_update: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
        }));
        vi.doMock('../../src/set-utils', () => ({
            generate_set_share_link: vi.fn().mockReturnValue('https://example.com/share/abc'),
        }));
        vi.doMock('../../src/dialog-set-share', () => ({
            PageSetShare: () => <div data-testid="share-dialog" />,
        }));
        vi.doMock('../../src/page/sharer', () => ({
            PageSharer: () => <div data-testid="sharer" />,
        }));
        vi.doMock('../../src/component/top-bar', () => ({
            TopBar: ({ title, before, children }: any) => (
                <div data-testid="topbar">
                    {before}
                    <span>{title}</span>
                    {children}
                </div>
            ),
        }));
        vi.doMock('../../src/component/song-list', () => ({
            SongListLink: ({ song, children }: any) => <div data-testid={`song-${song?.id || 'x'}`}>{children}</div>,
        }));
        vi.doMock('../../src/component/router-link', () => ({
            Link: ({ to, children, ...props }: any) => (
                <a href={to} {...props}>
                    {children}
                </a>
            ),
        }));
        vi.doMock('@dnd-kit/core', () => ({
            DndContext: ({ children }: any) => <div data-testid="dnd-context">{children}</div>,
            MouseSensor: class {},
            TouchSensor: class {},
            closestCenter: vi.fn(),
            useSensor: vi.fn(() => ({}) as any),
            useSensors: vi.fn(() => [] as any),
        }));
        vi.doMock('@dnd-kit/modifiers', () => ({
            restrictToVerticalAxis: vi.fn(),
            restrictToWindowEdges: vi.fn(),
        }));
        vi.doMock('@dnd-kit/sortable', () => ({
            SortableContext: ({ children }: any) => <div>{children}</div>,
            useSortable: vi.fn(() => ({
                setNodeRef: vi.fn(),
                transform: null,
                attributes: {},
                listeners: {},
                transition: undefined,
            })),
            verticalListSortingStrategy: vi.fn(),
        }));
        vi.doMock('@dnd-kit/utilities', () => ({
            CSS: { Transform: { toString: vi.fn(() => '') } },
        }));

        const mod = await import('../../src/page/set-view');
        PageSetView = mod.PageSetView;
    });

    it('renders set view page', async () => {
        renderWithRouter(<PageSetView set_id={1} />);

        const topbar = await screen.findByTestId('topbar');
        expect(topbar).toBeInTheDocument();
    });
});
