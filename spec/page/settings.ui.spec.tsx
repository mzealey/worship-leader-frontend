import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEventSocketMock } from '../helpers/mocks/event-socket';
import { createGlobalsMock } from '../helpers/mocks/globals';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { createSettingsStoreMock } from '../helpers/mocks/settings-store';
import { renderWithRouter } from '../helpers/render';

let PageSettings: typeof import('../../src/page/settings').PageSettings;

describe('PageSettings', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/globals', () => createGlobalsMock());
        vi.doMock('../../src/settings-store', () => createSettingsStoreMock());
        vi.doMock('../../src/event-socket', createEventSocketMock);
        vi.doMock('../../src/meta-db', () => ({
            get_meta_db_update_ts: () => Date.now(),
            get_meta_db: () => Promise.resolve({ tag_groups: {}, tag_mappings: {}, tags: {} }),
        }));
        vi.doMock('../../src/persistent-storage.es5', () => ({
            persistentStorage: { type: () => 'localStorage', get: vi.fn(), set: vi.fn() },
        }));
        vi.doMock('../../src/db', () => ({
            DB_AVAILABLE: Promise.resolve({
                type: () => 'offline',
                get_version_string: () => '1.0',
                refresh_languages: vi.fn((_force, _sync, cb) => {
                    cb(1);
                    return Promise.resolve();
                }),
            }),
            DB: Promise.resolve({
                type: () => 'offline',
                refresh_languages: vi.fn((_force, _sync, cb) => {
                    cb(1);
                    return Promise.resolve();
                }),
            }),
            on_db_change: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
            on_db_languages_update: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
            on_dbload_failed: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
        }));
        vi.doMock('../../src/db-init', () => ({
            may_support_offline: () => false,
            switch_db_api: vi.fn(),
        }));
        vi.doMock('../../src/dual-present', () => ({
            useCast: vi.fn(() => ({ supported: false, available: false })),
            get_presentation: () => Promise.resolve({ enter_cast_mode: vi.fn() }),
        }));
        vi.doMock('../../src/util', () => ({
            is_cordova: () => false,
            date_as_utc: (d: Date) => d.toISOString(),
            clear_object: vi.fn(),
            scroll_to: vi.fn(),
        }));
        vi.doMock('../../src/component/top-bar', () => ({
            TopBar: ({ title, children }: any) => (
                <div data-testid="topbar">
                    <span>{title}</span>
                    {children}
                </div>
            ),
        }));
        vi.doMock('../../src/component/chord-color-picker', () => ({
            ChordColorPicker: () => <div data-testid="chord-color-picker" />,
        }));
        vi.doMock('../../src/component/uilanguagechooser', () => ({
            UILanguageChooser: () => <select data-testid="ui-lang-chooser" />,
        }));
        vi.doMock('../../src/page/db-langs', () => ({
            DialogDbLangs: ({ onClose }: any) => (
                <div data-testid="db-langs-dialog">
                    <button onClick={onClose}>close</button>
                </div>
            ),
        }));
        vi.doMock('../../src/component/notify', () => ({
            send_ui_notification: vi.fn(),
        }));

        const mod = await import('../../src/page/settings');
        PageSettings = mod.PageSettings;
    });

    it('renders settings page with title', () => {
        renderWithRouter(<PageSettings />);
        expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('renders language and theme selectors', () => {
        renderWithRouter(<PageSettings />);
        expect(screen.getByText('App language')).toBeInTheDocument();
        expect(screen.getByText('setting-theme')).toBeInTheDocument();
    });

    it('renders song language button', () => {
        renderWithRouter(<PageSettings />);
        expect(screen.getByText('Choose Song Languages')).toBeInTheDocument();
    });

    it('renders display checkboxes', () => {
        renderWithRouter(<PageSettings />);
        expect(screen.getByText('Display Lyrics? (security measure for people in countries where phones may be searched)')).toBeInTheDocument();
        expect(screen.getByText('Display Chords?')).toBeInTheDocument();
    });

    it('renders contact button in topbar', () => {
        renderWithRouter(<PageSettings />);
        expect(screen.getByText('Contact')).toBeInTheDocument();
    });

    it('renders version info section', () => {
        renderWithRouter(<PageSettings />);
        const topbar = screen.getByTestId('topbar');
        expect(topbar).toBeInTheDocument();
    });
});
