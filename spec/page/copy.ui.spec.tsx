import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithProviders } from '../helpers/render';

let PageCopyTextarea: typeof import('../../src/page/copy').PageCopyTextarea;

describe('PageCopyTextarea', () => {
    const mockSong = {
        id: 1,
        title: 'Test Song',
        songxml: '<songxml>content</songxml>',
    } as any;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/songxml-util', () => ({
            convert_to_pre: vi.fn().mockReturnValue('<pre>converted content</pre>'),
        }));

        vi.doMock('../../src/page/edit', () => ({
            EditTypeChooser: ({ onChange }: { onChange: (t: string) => void }) => (
                <select data-testid="type-chooser" onChange={(e) => onChange(e.target.value)}>
                    <option value="chords">Chords</option>
                    <option value="opensong">OpenSong</option>
                </select>
            ),
        }));

        const mod = await import('../../src/page/copy');
        PageCopyTextarea = mod.PageCopyTextarea;
    });

    it('renders copy dialog', () => {
        renderWithProviders(<PageCopyTextarea song={mockSong} />);

        expect(screen.getByText('copybtn')).toBeInTheDocument();
    });

    it('renders cancel button', () => {
        renderWithProviders(<PageCopyTextarea song={mockSong} />);

        expect(screen.getByText('cancel_btn')).toBeInTheDocument();
    });

    it('renders type chooser dropdown', () => {
        renderWithProviders(<PageCopyTextarea song={mockSong} />);

        expect(screen.getByTestId('type-chooser')).toBeInTheDocument();
    });

    it('calls onClose when cancel clicked', async () => {
        const usr = userEvent.setup();
        const onClose = vi.fn();

        renderWithProviders(<PageCopyTextarea song={mockSong} onClose={onClose} />);

        await usr.click(screen.getByText('cancel_btn'));

        expect(onClose).toHaveBeenCalled();
    });
});
