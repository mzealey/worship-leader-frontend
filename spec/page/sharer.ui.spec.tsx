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

        expect(screen.getByText('sharebtn')).toBeInTheDocument();
        expect(screen.getByText('share_title')).toBeInTheDocument();
    });

    it('renders email share button', () => {
        renderWithRouter(<PageSharer url="/test" subject="Test Subject" title="Test Title" />);

        expect(screen.getByText('email')).toBeInTheDocument();
    });

    it('renders facebook share button', () => {
        renderWithRouter(<PageSharer url="/test" subject="Test Subject" title="Test Title" />);

        expect(screen.getByText('facebook')).toBeInTheDocument();
    });

    it('renders VK share button', () => {
        renderWithRouter(<PageSharer url="/test" subject="Test Subject" title="Test Title" />);

        expect(screen.getByText('vk')).toBeInTheDocument();
    });

    it('renders copy link input', () => {
        renderWithRouter(<PageSharer url="/test" subject="Test Subject" title="Test Title" />);

        expect(screen.getByText('copy_link')).toBeInTheDocument();
    });

    it('shows cancel button', () => {
        renderWithRouter(<PageSharer url="/test" subject="Test Subject" title="Test Title" />);

        expect(screen.getByText('cancel_btn')).toBeInTheDocument();
    });
});
