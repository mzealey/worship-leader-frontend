import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithProviders } from '../helpers/render';

let FileDownloadModule: typeof import('../../src/component/file-download');
let DownloadButton: typeof FileDownloadModule.DownloadButton;
let mockGetDownloadedFile: ReturnType<typeof vi.fn>;
let mockGetFile: ReturnType<typeof vi.fn>;
let mockDeleteDownloadedFile: ReturnType<typeof vi.fn>;
let mockDownloadFile: ReturnType<typeof vi.fn>;
let mockRemoveFile: ReturnType<typeof vi.fn>;

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

        mockGetDownloadedFile = vi.fn().mockReturnValue(undefined);
        mockGetFile = vi.fn().mockRejectedValue(new Error('not found'));
        mockDeleteDownloadedFile = vi.fn();
        mockDownloadFile = vi.fn();
        mockRemoveFile = vi.fn();

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/file-download-utils', () => ({
            get_downloaded_file: mockGetDownloadedFile,
            get_file: mockGetFile,
            delete_downloaded_file: mockDeleteDownloadedFile,
            download_file: mockDownloadFile,
            remove_file: mockRemoveFile,
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

        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('renders without crashing for download-only file', () => {
        renderWithProviders(<DownloadButton down_file_key="1-1" file={mockFile} song={mockSong} onDownload={mockOnDownload} />);

        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('calls download_file when button is clicked for undownloaded file', async () => {
        const user = userEvent.setup();

        renderWithProviders(<DownloadButton down_file_key="1-1" file={mockFile} song={mockSong} onDownload={mockOnDownload} />);

        const button = screen.getByRole('button');
        await user.click(button);

        expect(mockDownloadFile).toHaveBeenCalledWith(mockSong.id, mockFile, mockSong.title, expect.any(Function), expect.any(Function));
    });

    it('calls remove_file when already downloaded file button is clicked', async () => {
        const user = userEvent.setup();
        mockGetDownloadedFile.mockReturnValue({ path: '/local/path.mp3' });
        mockGetFile.mockResolvedValue({});
        mockRemoveFile.mockResolvedValue(undefined);

        renderWithProviders(<DownloadButton down_file_key="1-1" file={mockFile} song={mockSong} onDownload={mockOnDownload} />);

        const button = screen.getByRole('button');
        await user.click(button);

        expect(mockRemoveFile).toHaveBeenCalledWith({ path: '/local/path.mp3' });
    });

    it('sets active state when file is downloaded and exists', async () => {
        mockGetDownloadedFile.mockReturnValue({ path: '/local/path.mp3' });
        mockGetFile.mockResolvedValue({});

        renderWithProviders(<DownloadButton down_file_key="1-1" file={mockFile} song={mockSong} onDownload={mockOnDownload} />);

        await vi.waitFor(() => {
            expect(screen.getByRole('button')).toBeInTheDocument();
        });
    });

    it('removes local record when downloaded file no longer exists', async () => {
        mockGetDownloadedFile.mockReturnValue({ path: '/local/path.mp3' });
        mockGetFile.mockRejectedValue(new Error('gone'));

        renderWithProviders(<DownloadButton down_file_key="1-1" file={mockFile} song={mockSong} onDownload={mockOnDownload} />);

        await vi.waitFor(() => {
            expect(mockDeleteDownloadedFile).toHaveBeenCalledWith('1-1');
        });
    });

    it('download_file calls onDownload callback', async () => {
        const user = userEvent.setup();

        renderWithProviders(<DownloadButton down_file_key="1-1" file={mockFile} song={mockSong} onDownload={mockOnDownload} />);

        const button = screen.getByRole('button');
        await user.click(button);

        expect(mockDownloadFile).toHaveBeenCalled();

        const progressCallback = mockDownloadFile.mock.calls[0][3];
        progressCallback({ active: 1, loading: 0 });
        progressCallback({ active: 0, loading: 1 });
        progressCallback({ active: 0, loading: 0 });
    });
});
