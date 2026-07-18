import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { createUseDialogMock } from '../helpers/mocks/use-dialog';
import { renderWithRouter } from '../helpers/render';

let PageSharer: typeof import('../../src/page/sharer').PageSharer;

describe('PageSharer', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/use-dialog', createUseDialogMock);
        vi.doMock('../../src/globals', () => ({
            BUILD_TYPE: 'www',
            SHARE_DOMAIN: 'example.com',
        }));
        vi.doMock('../../src/util', () => ({
            generate_search_params: vi.fn().mockReturnValue(''),
            normalize_url: (url: string, domain: string) => `https://${domain}${url}`,
            is_cordova: () => false,
            is_mobile_browser: () => false,
        }));

        const mod = await import('../../src/page/sharer');
        PageSharer = mod.PageSharer;
    });

    it('renders share dialog', () => {
        renderWithRouter(<PageSharer url="/test" subject="Test Subject" title="Test Title" />);

        expect(screen.getByText('Share')).toBeInTheDocument();
        expect(screen.getByText('How do you want to share this?')).toBeInTheDocument();
    });

    it('renders email share button', () => {
        renderWithRouter(<PageSharer url="/test" subject="Test Subject" title="Test Title" />);

        expect(screen.getByText('Email')).toBeInTheDocument();
    });

    it('renders facebook share button', () => {
        renderWithRouter(<PageSharer url="/test" subject="Test Subject" title="Test Title" />);

        expect(screen.getByText('Facebook')).toBeInTheDocument();
    });

    it('renders VK share button', () => {
        renderWithRouter(<PageSharer url="/test" subject="Test Subject" title="Test Title" />);

        expect(screen.getByText('VK')).toBeInTheDocument();
    });

    it('renders copy link option', () => {
        renderWithRouter(<PageSharer url="/test" subject="Test Subject" title="Test Title" />);

        expect(screen.getByText('Copy Link')).toBeInTheDocument();
    });

    it('shows cancel button', () => {
        renderWithRouter(<PageSharer url="/test" subject="Test Subject" title="Test Title" />);

        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
});
