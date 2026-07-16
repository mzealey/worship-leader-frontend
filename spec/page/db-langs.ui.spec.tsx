import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { createUseDialogMock } from '../helpers/mocks/use-dialog';
import { renderWithRouter } from '../helpers/render';

let DialogDbLangs: typeof import('../../src/page/db-langs').DialogDbLangs;

describe('DialogDbLangs', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/use-dialog', createUseDialogMock);
        vi.doMock('../../src/db', () => ({
            DB_AVAILABLE: Promise.resolve({
                get_chosen_langs: vi.fn().mockResolvedValue(['en', 'tr']),
                get_available_langs: vi.fn().mockResolvedValue({ en: 'English', tr: 'Turkish', fr: 'French' }),
                update_db_languages: vi.fn().mockResolvedValue(undefined),
                language_counts: vi.fn().mockResolvedValue({ en: 100, tr: 50 }),
            }),
            on_db_languages_update: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })), next: vi.fn() },
        }));
        vi.doMock('../../src/component/notify', () => ({
            send_ui_notification: vi.fn(),
        }));

        const mod = await import('../../src/page/db-langs');
        DialogDbLangs = mod.DialogDbLangs;
    });

    it('renders language selection dialog', async () => {
        renderWithRouter(<DialogDbLangs />);

        await screen.findByText('db_langs_title');
        expect(screen.getByText('db_langs_title')).toBeInTheDocument();
    });
});
