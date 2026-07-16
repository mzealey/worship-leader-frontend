import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithRouter } from '../helpers/render';

let PagePrintSongbook: typeof import('../../src/page/page-print-songbook').PagePrintSongbook;

describe('PagePrintSongbook', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/db', () => ({
            DB: Promise.resolve({
                get_song: vi.fn().mockResolvedValue(null),
                get_songs: vi.fn().mockResolvedValue([]),
            }),
            DB_AVAILABLE: Promise.resolve({}),
        }));
        vi.doMock('../../src/db/common', () => ({
            get_db_chosen_langs: vi.fn(() => []),
        }));
        vi.doMock('../../src/set-db', () => ({
            SET_DB: {
                get_songs: vi.fn(() => []),
                get_set_title: vi.fn().mockResolvedValue(''),
            },
            on_set_db_update: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
        }));
        vi.doMock('../../src/util', () => ({
            timeout: vi.fn().mockResolvedValue(true),
        }));
        vi.doMock('comlink', () => ({
            wrap: vi.fn(() => ({
                ping: vi.fn().mockResolvedValue(true),
                setSongbookData: vi.fn(),
                updateConfig: vi.fn(),
            })),
            windowEndpoint: vi.fn(),
            proxy: vi.fn(),
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
        vi.doMock('../../src/component/router-link', () => ({
            Link: ({ to, children, ...props }: any) => (
                <a href={to} {...props}>
                    {children}
                </a>
            ),
        }));
        vi.doMock('../../langpack/index.json', () => ({ default: { en: {}, tr: {} } }));

        const mod = await import('../../src/page/page-print-songbook');
        PagePrintSongbook = mod.PagePrintSongbook;
    });

    it('renders print songbook page', () => {
        renderWithRouter(<PagePrintSongbook set_id={1} />);

        expect(screen.getByText('print-songbook')).toBeInTheDocument();
    });

    it('renders paper size options', () => {
        renderWithRouter(<PagePrintSongbook set_id={1} />);

        expect(screen.getByText('editor.paper_size')).toBeInTheDocument();
        expect(screen.getByText('editor.font_size')).toBeInTheDocument();
        expect(screen.getByText('editor.columns')).toBeInTheDocument();
    });

    it('renders language selector', () => {
        renderWithRouter(<PagePrintSongbook set_id={1} />);

        expect(screen.getByText('editor.songbook_language')).toBeInTheDocument();
    });

    it('renders boolean setting checkboxes', () => {
        renderWithRouter(<PagePrintSongbook set_id={1} />);

        expect(screen.getByText('editor.include_chords')).toBeInTheDocument();
        expect(screen.getByText('editor.include_front_page')).toBeInTheDocument();
    });

    it('renders an iframe for the songbook viewer', () => {
        const { container } = renderWithRouter(<PagePrintSongbook set_id={1} />);

        const iframe = container.querySelector('iframe');
        expect(iframe).toBeInTheDocument();
        expect(iframe?.getAttribute('src')).toBe('songbook-viewer.html');
    });

    it('shows loading spinner when no base data', () => {
        const { container } = renderWithRouter(<PagePrintSongbook set_id={1} />);

        const spinner = container.querySelector('.MuiCircularProgress-root');
        expect(spinner).toBeInTheDocument();
    });

    it('renders back button', () => {
        renderWithRouter(<PagePrintSongbook set_id={1} />);

        expect(screen.getByText('back')).toBeInTheDocument();
    });
});
