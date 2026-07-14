import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithProviders } from '../helpers/render';

let PageSetRename: typeof import('../../src/page/dialog-set-rename').PageSetRename;
let mockSET_DB: {
    rename_set: ReturnType<typeof vi.fn>;
    get_set_title: ReturnType<typeof vi.fn>;
};

describe('PageSetRename', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        mockSET_DB = {
            rename_set: vi.fn().mockResolvedValue(undefined),
            get_set_title: vi.fn().mockResolvedValue('Current Name'),
        };

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/set-db', () => ({
            SET_DB: mockSET_DB,
        }));

        const mod = await import('../../src/page/dialog-set-rename');
        PageSetRename = mod.PageSetRename;
    });

    it('renders rename dialog', () => {
        renderWithProviders(<PageSetRename set_id={1} />);

        expect(screen.getByText('rename_set')).toBeInTheDocument();
        expect(screen.getByText('cancel_btn')).toBeInTheDocument();
    });

    it('loads current set name', async () => {
        renderWithProviders(<PageSetRename set_id={1} />);

        await waitFor(() => {
            expect(mockSET_DB.get_set_title).toHaveBeenCalledWith(1);
        });
    });

    it('disables rename button when name is empty', () => {
        mockSET_DB.get_set_title.mockResolvedValue('');

        renderWithProviders(<PageSetRename set_id={1} />);

        const renameBtn = screen.getByText('rename_set_btn');
        expect(renameBtn).toBeDisabled();
    });

    it('calls rename_set on rename button click', async () => {
        const user = userEvent.setup();

        renderWithProviders(<PageSetRename set_id={5} />);

        // The input has preloaded value 'Current Name' from get_set_title
        const input = document.querySelector('input')!;
        await user.tripleClick(input); // select all current text
        await user.keyboard('New Name');

        await user.click(screen.getByText('rename_set_btn'));

        expect(mockSET_DB.rename_set).toHaveBeenCalledWith(5, 'New Name');
    });
});
