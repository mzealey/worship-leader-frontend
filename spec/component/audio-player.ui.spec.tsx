import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../helpers/render';

let AudioPlayer: typeof import('../../src/component/audio-player').AudioPlayer;

describe('AudioPlayer', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/feedback', () => ({
            file_feedback: vi.fn(),
            song_feedback: vi.fn(),
        }));
        vi.doMock('../../src/file-download-utils', () => ({
            get_downloaded_file: vi.fn(),
            is_local_url_allowed: vi.fn(() => false),
        }));
        vi.doMock('../../src/page-padding', () => ({
            usePagePadding: vi.fn((sel: (s: any) => any) => sel({ top: 0, bottom: 0 })),
        }));
        vi.doMock('../../src/page/sharer', () => ({
            PageSharer: () => <div />,
        }));
        vi.doMock('../../src/component/file-download', () => ({
            DownloadButton: ({ file }: any) => <button data-testid="download-btn">{file?.id}</button>,
        }));
        vi.doMock('../../src/component/icons', () => ({
            PlaySong: () => <svg data-testid="icon-play" />,
            PauseSong: () => <svg data-testid="icon-pause" />,
            Download: () => <svg data-testid="icon-download" />,
            Sharer: () => <svg data-testid="icon-share" />,
            Share: () => <svg data-testid="icon-share" />,
            Play: () => <svg data-testid="icon-play" />,
            ReloadSong: () => <svg data-testid="icon-reload" />,
        }));

        const mod = await import('../../src/component/audio-player');
        AudioPlayer = mod.AudioPlayer;
    });

    it('renders an audio player element', () => {
        const song = { id: 1, title: 'Test', lang: 'en' } as any;
        const file = { id: 10, type: 'mp3', path: '/test.mp3', name: 'Test' } as any;

        const { container } = renderWithProviders(<AudioPlayer song={song} file={file} />);
        expect(container).toBeTruthy();
    });

    it('shows download button', () => {
        const song = { id: 1, title: 'Test', lang: 'en' } as any;
        const file = { id: 10, type: 'mp3', path: '/test.mp3', name: 'Test' } as any;

        renderWithProviders(<AudioPlayer song={song} file={file} />);
        expect(screen.getByTestId('download-btn')).toBeInTheDocument();
    });

    it('renders with promo file type', () => {
        const song = { id: 1, title: 'Test', lang: 'en' } as any;
        const file = { id: 10, type: 'promomp3', path: '/test.mp3', name: 'Test' } as any;

        renderWithProviders(<AudioPlayer song={song} file={file} />);
        expect(screen.getByTestId('download-btn')).toBeInTheDocument();
    });
});
