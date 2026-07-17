import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithProviders } from '../helpers/render';

let PageSourceSelect: typeof import('../../src/page/source-select').PageSourceSelect;

describe('PageSourceSelect', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/db', () => ({
            DB: Promise.resolve({
                get_song_sources: vi.fn().mockResolvedValue([
                    { id: 1, name: 'Source A', lang: 'en' },
                    { id: 2, name: 'Source B', lang: 'en' },
                    { id: 3, name: 'Source C', lang: 'fr' },
                ]),
            }),
            on_db_languages_update: {
                subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
            },
        }));
        vi.doMock('../../src/db-search', () => ({
            useSearchStore: () => ({ sources: {} }),
        }));
        vi.doMock('../../src/filter-sources', () => ({
            toggle_filter_source: vi.fn(),
        }));

        const mod = await import('../../src/page/source-select');
        PageSourceSelect = mod.PageSourceSelect;
    });

    it('renders source select dialog', async () => {
        renderWithProviders(<PageSourceSelect />);

        expect(await screen.findByText('Choose Song Books')).toBeInTheDocument();
        expect(screen.getByText('Continue')).toBeInTheDocument();
    });

    it('renders language headings for each source language', async () => {
        renderWithProviders(<PageSourceSelect />);

        // lang_name mock returns the code as-is
        expect(await screen.findByText('en')).toBeInTheDocument();
        expect(screen.getByText('fr')).toBeInTheDocument();
    });
});
