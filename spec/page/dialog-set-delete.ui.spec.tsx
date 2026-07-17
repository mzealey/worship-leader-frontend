import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithRouter } from '../helpers/render';

let PageSetDelete: typeof import('../../src/page/dialog-set-delete').PageSetDelete;
let mockSET_DB: { delete_set: ReturnType<typeof vi.fn> };

describe('PageSetDelete', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        mockSET_DB = { delete_set: vi.fn() };

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/use-dialog', () => ({
            useDialog: (onClose?: () => void) => ({
                closed: false,
                handleClose: () => onClose?.(),
            }),
        }));
        vi.doMock('../../src/set-db', () => ({
            SET_DB: mockSET_DB,
        }));

        const mod = await import('../../src/page/dialog-set-delete');
        PageSetDelete = mod.PageSetDelete;
    });

    it('renders delete confirmation dialog', () => {
        renderWithRouter(<PageSetDelete set_id={1} />);

        expect(screen.getByText('Delete Set?')).toBeInTheDocument();
        expect(screen.getByText('Do you really want to delete this set?')).toBeInTheDocument();
    });

    it('renders cancel and delete buttons', () => {
        renderWithRouter(<PageSetDelete set_id={1} />);

        expect(screen.getByText('Cancel')).toBeInTheDocument();
        expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('calls SET_DB.delete_set when delete button clicked', async () => {
        const user = userEvent.setup();

        renderWithRouter(<PageSetDelete set_id={42} />);

        await user.click(screen.getByText('Delete'));

        expect(mockSET_DB.delete_set).toHaveBeenCalledWith(42);
    });

    it('calls onClose callback after delete', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();

        renderWithRouter(<PageSetDelete set_id={1} onClose={onClose} />);

        await user.click(screen.getByText('Delete'));

        expect(onClose).toHaveBeenCalled();
    });
});
