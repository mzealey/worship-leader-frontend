import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalAudio = globalThis.Audio;

describe('audio-player (AudioPlayer component)', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.stubGlobal(
            'Audio',
            class {
                play = vi.fn().mockResolvedValue(undefined);
                pause = vi.fn();
                load = vi.fn();
                addEventListener = vi.fn();
                removeEventListener = vi.fn();
                currentTime = 0;
                duration = 0;
                buffered = { length: 0, start: vi.fn(), end: vi.fn() };
                readyState = 0;
                src = '';
            },
        );
    });

    afterEach(() => {
        vi.stubGlobal('Audio', originalAudio);
    });

    it('imports AudioPlayer without crashing', async () => {
        vi.doMock('../../src/langpack', () => ({
            useTranslation: () => ({ t: (key: string) => key }),
        }));
        vi.doMock('../../src/feedback', () => ({
            file_feedback: vi.fn(),
        }));
        vi.doMock('../../src/file-download-utils', () => ({
            get_downloaded_file: vi.fn(),
            is_local_url_allowed: vi.fn(() => false),
        }));
        vi.doMock('../../src/page/sharer', () => ({
            PageSharer: () => <div />,
        }));
        vi.doMock('../../src/component/file-download', () => ({
            DownloadButton: () => <button />,
        }));
        vi.doMock('../../src/component/icons', () => ({}));
        vi.doMock('../../src/page-padding', () => ({
            usePagePadding: vi.fn(() => ({ top: 0, bottom: 0 })),
        }));

        const mod = await import('../../src/component/audio-player');
        expect(mod.AudioPlayer).toBeDefined();
    });
});
