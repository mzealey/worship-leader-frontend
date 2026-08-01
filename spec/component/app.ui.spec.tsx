import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';

let App: typeof import('../../src/component/app').App;

describe('App', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/langpack/index.json', () => ({ default: { en: {}, tr: {} } }));
        vi.doMock('../../src/db', () => ({
            DB: Promise.resolve({
                type: () => 'offline',
                get_song: vi.fn().mockResolvedValue({}),
                get_songs: vi.fn().mockResolvedValue([]),
                populate_db: vi.fn().mockResolvedValue(undefined),
                ideal_debounce: () => 300,
                get_version_string: () => '1.0',
            }),
            DB_AVAILABLE: Promise.resolve({
                type: () => 'offline',
                get_chosen_langs: vi.fn().mockResolvedValue(['en']),
                populate_db: vi.fn().mockResolvedValue(undefined),
                ideal_debounce: () => 300,
            }),
            on_db_change: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
            on_db_languages_update: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
            on_dbload_failed: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
        }));
        vi.doMock('../../src/db/common', () => ({
            get_db_chosen_langs: vi.fn(() => ['en']),
            save_db_chosen_langs: vi.fn(),
        }));
        vi.doMock('../../src/globals', () => ({
            is_firsttime: false,
            BUILD_TYPE: 'www',
            DEBUG: false,
            APP_VERSION: '1.0',
            get_client_type: () => 'www',
            get_uuid: () => 'test-uuid',
        }));
        vi.doMock('../../src/langdetect.es5', () => ({
            get_app_languages: vi.fn(() => [{ code: 'en' }]),
        }));
        vi.doMock('../../src/splash-util.es5', () => ({
            gup: vi.fn(() => null),
            is_bot: vi.fn(() => false),
            parse_search: vi.fn(() => ({})),
        }));
        vi.doMock('../../src/song-languages', () => ({
            get_default_db_languages: vi.fn(() => ['en']),
        }));
        vi.doMock('../../src/set', () => ({
            create_set_from_url: vi.fn(),
        }));
        vi.doMock('../../src/component/analytics', () => ({
            GATracker: class {},
        }));
        vi.doMock('../../src/component/container', () => ({
            PagesContainer: ({ children }: any) => <div data-testid="pages-container">{children}</div>,
        }));
        vi.doMock('../../src/component/lock-screen', () => ({
            Spinner: () => <div data-testid="spinner" />,
            LockScreen: () => <div data-testid="lock-screen" />,
        }));
        vi.doMock('../../src/page/firsttime-welcome', () => ({
            PageFirsttimeWelcome: () => <div data-testid="firsttime-welcome" />,
        }));
        vi.doMock('../../src/page/db-langs', () => ({
            DialogDbLangs: () => <div data-testid="db-langs" />,
            PageDbLangs: () => <div data-testid="db-langs-page" />,
        }));
        vi.doMock('../../src/page/songinfo', () => ({
            PageSongInfo: () => <div data-testid="song-info" />,
        }));
        vi.doMock('../../src/page/set-view', () => ({
            PageSetView: () => <div data-testid="set-view" />,
        }));
        vi.doMock('../../src/page/page-print-songbook', () => ({
            PagePrintSongbook: () => <div data-testid="print-songbook" />,
        }));
        vi.doMock('../../src/page/set-list', () => ({
            PageSetList: () => <div data-testid="set-list" />,
        }));
        vi.doMock('../../src/page/settings', () => ({
            PageSettings: () => <div data-testid="settings" />,
        }));
        vi.doMock('../../src/page/edit', () => ({
            PageEditTextarea: () => <div data-testid="edit" />,
            PageEditSong: () => <div data-testid="edit-song" />,
        }));
        vi.doMock('../../src/page/native-prompter', () => ({
            PageNativePrompter: () => <div data-testid="native-prompter" />,
        }));
        vi.doMock('../../src/page/list', () => ({
            PageList: () => <div data-testid="page-list" />,
        }));
        vi.doMock('../../src/page/dbload-failed', () => ({
            PageDbLoadFailed: () => <div data-testid="db-load-failed" />,
        }));

        const mod = await import('../../src/component/app');
        App = mod.App;
    });

    it('renders the app shell', () => {
        const { container } = render(
            <MemoryRouter>
                <App />
            </MemoryRouter>,
        );
        expect(container).toBeTruthy();
    });
});
