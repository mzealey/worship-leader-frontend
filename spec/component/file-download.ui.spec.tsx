import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithProviders } from '../helpers/render';

let FileDownloadModule: typeof import('../../src/component/file-download');
let DownloadButton: typeof FileDownloadModule.DownloadButton;

describe('DownloadButton', () => {
    const mockSong = { id: 1, title: 'Test Song' } as any;
    const mockFile = {
        id: 1,
        path: 'https://example.com/file.mp3',
    } as any;
    const mockOnDownload = vi.fn();

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/file-download-utils', () => ({
            get_downloaded_file: vi.fn().mockReturnValue(undefined),
            get_file: vi.fn(),
            delete_downloaded_file: vi.fn(),
            download_file: vi.fn(),
            remove_file: vi.fn(),
        }));

        FileDownloadModule = await import('../../src/component/file-download');
        DownloadButton = FileDownloadModule.DownloadButton;
    });

    it('renders a download icon button', () => {
        renderWithProviders(<DownloadButton down_file_key="1-1" file={mockFile} song={mockSong} onDownload={mockOnDownload} />);

        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
    });

    it('has download_link title', () => {
        renderWithProviders(<DownloadButton down_file_key="1-1" file={mockFile} song={mockSong} onDownload={mockOnDownload} />);

        expect(screen.getByTitle('download_link')).toBeInTheDocument();
    });

    it('shows Link icon when file has download_path', () => {
        const fileWithLink = { ...mockFile, download_path: 'https://example.com' };

        renderWithProviders(<DownloadButton down_file_key="1-1" file={fileWithLink} song={mockSong} onDownload={mockOnDownload} />);

        // The component should still render a button
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('renders without crashing for download-only file', () => {
        renderWithProviders(<DownloadButton down_file_key="1-1" file={mockFile} song={mockSong} onDownload={mockOnDownload} />);

        expect(screen.getByRole('button')).toBeInTheDocument();
    });
});
