// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { persistentStorage } from '../src/persistent-storage.es5';

describe('settings-store', function () {
    let settingsStoreMod: typeof import('../src/settings-store');

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        // Clear persistent storage to ensure clean state
        persistentStorage.clear();

        // Mock is_bot to return false
        vi.doMock('../src/splash-util.es5', () => ({
            is_bot: () => false,
        }));

        // Mock is_cordova to return false
        vi.doMock('../src/util', () => ({
            is_cordova: () => false,
        }));

        settingsStoreMod = await import('../src/settings-store');
    });

    afterEach(() => {
        persistentStorage.clear();
        vi.resetModules();
    });

    describe('useSettingsStore', function () {
        it('initializes with default settings', function () {
            const { settings } = settingsStoreMod.useSettingsStore.getState();

            expect(settings['chord-color']).toBe('#000000');
            expect(settings['display-chords']).toBe(true);
            expect(settings['display-lyrics']).toBe(true);
            expect(settings['hide-toolbar-btn']).toBe(false);
            expect(settings['observe-copyright']).toBe(false);
            expect(settings['show-fingering']).toBe(true);
            expect(settings['song-zoom']).toBe('medium');
            expect(settings['use-solfege']).toBe(false);
            expect(settings.poweron).toBe(false);
            expect(settings.sidebyside).toBe(false);
            expect(settings.theme).toBe('');
        });

        it('updateSetting changes a setting value', function () {
            const store = settingsStoreMod.useSettingsStore;
            store.getState().updateSetting('chord-color', '#FF0000');

            expect(store.getState().settings['chord-color']).toBe('#FF0000');
        });

        it('updateSetting changes boolean settings', function () {
            const store = settingsStoreMod.useSettingsStore;
            store.getState().updateSetting('display-chords', false);

            expect(store.getState().settings['display-chords']).toBe(false);
        });

        it('updateSetting persists changes to storage', function () {
            const store = settingsStoreMod.useSettingsStore;
            store.getState().updateSetting('song-zoom', 'large');

            const stored = persistentStorage.get('settings-storage');
            expect(stored).toBeTruthy();
            const parsed = JSON.parse(stored!);
            expect(parsed.state.settings['song-zoom']).toBe('large');
        });
    });

    describe('useSetting hook', function () {
        it('is exported as a function', function () {
            expect(typeof settingsStoreMod.useSetting).toBe('function');
        });
    });

    describe('getSetting', function () {
        it('returns current setting value', function () {
            expect(settingsStoreMod.getSetting('song-zoom')).toBe('medium');
            expect(settingsStoreMod.getSetting('display-lyrics')).toBe(true);
            expect(settingsStoreMod.getSetting('theme')).toBe('');
        });
    });

    describe('updateSetting', function () {
        it('updates a setting value', function () {
            settingsStoreMod.updateSetting('hide-toolbar-btn', true);

            expect(settingsStoreMod.getSetting('hide-toolbar-btn')).toBe(true);
        });
    });

    describe('migration from persistentStorage', function () {
        it('migrates old persistent storage values', async function () {
            // Setup old-style persistent storage values
            persistentStorage.set('setting-display-chords', 'false');
            persistentStorage.set('setting-display-lyrics', 'true');
            persistentStorage.set('setting-song-zoom', 'large');

            vi.resetModules();
            // Need fresh module to use migrated values
            vi.doMock('../src/splash-util.es5', () => ({
                is_bot: () => false,
            }));
            vi.doMock('../src/util', () => ({
                is_cordova: () => false,
            }));

            const freshMod = await import('../src/settings-store');

            expect(freshMod.getSetting('display-chords')).toBe(false);
            expect(freshMod.getSetting('display-lyrics')).toBe(true);
            expect(freshMod.getSetting('song-zoom')).toBe('large');
        });

        it('handles malformed boolean values', async function () {
            persistentStorage.set('setting-display-chords', 'invalid');

            vi.resetModules();
            vi.doMock('../src/splash-util.es5', () => ({
                is_bot: () => false,
            }));
            vi.doMock('../src/util', () => ({
                is_cordova: () => false,
            }));

            const freshMod = await import('../src/settings-store');

            // Should fall back to default (true) since 'invalid' is not 'true' or 'false'
            expect(freshMod.getSetting('display-chords')).toBe(true);
        });
    });

    describe('is_bot integration', function () {
        it('sets display-chords to false when is_bot returns true', async function () {
            persistentStorage.clear();
            vi.resetModules();

            vi.doMock('../src/splash-util.es5', () => ({
                is_bot: () => true,
            }));
            vi.doMock('../src/util', () => ({
                is_cordova: () => false,
            }));

            const freshMod = await import('../src/settings-store');

            expect(freshMod.getSetting('display-chords')).toBe(false);
        });
    });
});
