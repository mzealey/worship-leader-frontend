import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithRouter } from '../helpers/render';

let PageSetShare: typeof import('../../src/page/dialog-set-share').PageSetShare;

describe('PageSetShare', () => {
    const mockSet = {
        id: 1,
        uuid: 'test-uuid',
        name: 'Test Set',
        live: 0 as 0 | 1,
        songs: [{ song_id: 1, song_key: 'C', capo: 0 }],
    };

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/set-utils', () => ({
            generate_set_share_link: vi.fn().mockReturnValue('#page-set-list?new_set=Test%20Set'),
        }));

        const mod = await import('../../src/page/dialog-set-share');
        PageSetShare = mod.PageSetShare;
    });

    it('renders share dialog', () => {
        renderWithRouter(<PageSetShare set={mockSet} />);

        expect(screen.getByText('Share Set')).toBeInTheDocument();
    });

    it('renders share buttons', () => {
        renderWithRouter(<PageSetShare set={mockSet} />);

        expect(screen.getByText('Share Live Set')).toBeInTheDocument();
        expect(screen.getByText('Share Copy')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('calls onShare when live share button clicked', async () => {
        const usr = userEvent.setup();
        const onShare = vi.fn();

        renderWithRouter(<PageSetShare set={mockSet} onShare={onShare} />);

        await usr.click(screen.getByText('Share Live Set'));

        expect(onShare).toHaveBeenCalledWith('#page-set-list?new_set=Test%20Set');
    });

    it('calls onShare when normal share button clicked', async () => {
        const usr = userEvent.setup();
        const onShare = vi.fn();

        renderWithRouter(<PageSetShare set={mockSet} onShare={onShare} />);

        await usr.click(screen.getByText('Share Copy'));

        expect(onShare).toHaveBeenCalledWith('#page-set-list?new_set=Test%20Set');
    });
});
