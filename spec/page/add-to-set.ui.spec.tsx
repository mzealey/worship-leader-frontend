import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithProviders } from '../helpers/render';

let DialogAddToSet: typeof import('../../src/page/add-to-set').DialogAddToSet;
let mockSET_DB: {
    create_set: ReturnType<typeof vi.fn>;
    add_song_to_set: ReturnType<typeof vi.fn>;
    get_set_list: ReturnType<typeof vi.fn>;
};

describe('DialogAddToSet', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        mockSET_DB = {
            create_set: vi.fn(),
            add_song_to_set: vi.fn(),
            get_set_list: vi.fn().mockResolvedValue([
                { id: 1, name: 'My Set', ro: 0 },
                { id: 2, name: 'Read Only', ro: 1 },
            ]),
        };

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/set-db', () => ({
            SET_DB: mockSET_DB,
            on_set_db_update: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
        }));
        vi.doMock('../../src/feedback', () => ({
            song_feedback: vi.fn(),
        }));

        const mod = await import('../../src/page/add-to-set');
        DialogAddToSet = mod.DialogAddToSet;
    });

    it('renders the dialog with title and input field', () => {
        renderWithProviders(<DialogAddToSet song_id={123} />);

        expect(screen.getByText('add_song_to_set')).toBeInTheDocument();
        expect(screen.getByText('set_create')).toBeInTheDocument();
    });

    it('renders existing writable sets', async () => {
        renderWithProviders(<DialogAddToSet song_id={123} />);

        const mySet = await screen.findByText('My Set');
        expect(mySet).toBeInTheDocument();
        expect(screen.queryByText('Read Only')).toBeNull();
    });

    it('create button is disabled when no set name entered', () => {
        renderWithProviders(<DialogAddToSet song_id={123} />);

        const createBtn = screen.getByText('set_create');
        expect(createBtn.closest('button')).toBeDisabled();
    });

    it('calls create_set and add_song_to_set when adding to existing set', async () => {
        mockSET_DB.add_song_to_set.mockResolvedValue(undefined);
        const onClose = vi.fn();

        renderWithProviders(<DialogAddToSet song_id={123} onClose={onClose} />);

        const mySetBtn = await screen.findByText('My Set');
        const user = userEvent.setup();
        await user.click(mySetBtn);

        expect(mockSET_DB.add_song_to_set).toHaveBeenCalledWith(1, 123, '', 0);
    });

    it('creates new set when name entered and button clicked', async () => {
        const user = userEvent.setup();
        mockSET_DB.create_set.mockResolvedValue(5);
        mockSET_DB.add_song_to_set.mockResolvedValue(undefined);
        const onClose = vi.fn();

        renderWithProviders(<DialogAddToSet song_id={123} onClose={onClose} />);

        const input = document.querySelector('input')!;
        await user.type(input, 'New Set Name');

        const createBtn = screen.getByText('set_create');
        expect(createBtn.closest('button')).not.toBeDisabled();

        await user.click(createBtn);

        expect(mockSET_DB.create_set).toHaveBeenCalledWith('New Set Name');
        await vi.waitFor(() => {
            expect(mockSET_DB.add_song_to_set).toHaveBeenCalledWith(5, 123, '', 0);
        });
    });

    it('shows duplicate alert when addSongToSet fails', async () => {
        const user = userEvent.setup();
        mockSET_DB.add_song_to_set.mockRejectedValue(new Error('duplicate'));

        renderWithProviders(<DialogAddToSet song_id={123} />);

        const mySetBtn = await screen.findByText('My Set');
        await user.click(mySetBtn);

        await screen.findByText('already_in_set');
        expect(screen.getByText('already_in_set')).toBeInTheDocument();
    });

    it('passes transpose key and capo when provided', async () => {
        const user = userEvent.setup();
        mockSET_DB.add_song_to_set.mockResolvedValue(undefined);

        renderWithProviders(<DialogAddToSet song_id={123} transpose={{ keyName: 'D', capo: 2 }} />);

        const mySetBtn = await screen.findByText('My Set');
        await user.click(mySetBtn);

        expect(mockSET_DB.add_song_to_set).toHaveBeenCalledWith(1, 123, 'D', 2);
    });
});
