import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEventSocketMock } from '../helpers/mocks/event-socket';

describe('songinfo-sidebar', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('can import SongInfoSide and related components', async () => {
        vi.doMock('../../src/event-socket', createEventSocketMock);
        vi.doMock('../../src/favourite-db', () => ({
            FAVOURITE_DB: {
                get_favourite: () => null,
                set_favourite: vi.fn(),
                del_favourite: vi.fn(),
            },
        }));
        vi.doMock('../../src/feedback', () => ({
            file_feedback: vi.fn(),
            song_feedback: vi.fn(),
        }));
        vi.doMock('../../src/file-download-utils', () => ({
            try_window_open_download: vi.fn(),
            get_downloaded_file: vi.fn(),
            is_local_url_allowed: () => false,
        }));
        vi.doMock('../../src/filter-sources', () => ({
            toggle_filter_source: vi.fn(),
        }));
        vi.doMock('../../src/globals', () => ({
            API_HOST: '',
            DEBUG: false,
        }));
        vi.doMock('../../src/langpack', () => ({
            useTranslation: () => ({ t: (key: string) => key }),
        }));
        vi.doMock('../../src/settings-store', () => ({
            useSetting: () => [false, vi.fn()],
        }));
        vi.doMock('../../src/persistent-storage.es5', () => ({
            persistentStorage: { get: vi.fn(), set: vi.fn() },
        }));
        vi.doMock('../../src/search', () => ({
            set_search_text: vi.fn(),
        }));
        vi.doMock('../../src/solfege-util', () => ({
            maybe_convert_solfege: (s: string) => s,
        }));
        vi.doMock('../../src/util', () => ({
            format_string: (s: string) => s,
            get_youtube_id: () => '',
            is_rtl: () => false,
            is_vertical_lang: () => false,
        }));
        vi.doMock('../../src/component/audio-player', () => ({
            AudioPlayer: () => <div />,
        }));
        vi.doMock('../../src/component/basic', () => ({
            DropDownIcon: () => <div />,
            ImageButton: ({ children }: any) => <button>{children}</button>,
        }));
        vi.doMock('../../src/component/tags-section', () => ({
            TagsSection: () => <div />,
        }));
        vi.doMock('../../src/component/song-list', () => ({
            SongListLink: () => <div />,
            TextDirection: ({ children }: any) => <span>{children}</span>,
        }));
        vi.doMock('../../src/component/icons', () => ({}));

        const mod = await import('../../src/component/songinfo-sidebar');
        expect(mod.SongInfoSide).toBeDefined();
        expect(mod.FavouriteButton).toBeDefined();
        expect(mod.PrintCapoDisplay).toBeDefined();
        expect(mod.SongTopInfoSection).toBeDefined();
    });
});
