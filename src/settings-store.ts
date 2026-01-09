import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { update_poweron } from './cordova-setup';
import { persistentStorage } from './persistent-storage.es5';
import { is_bot } from './splash-util.es5';

export interface Settings {
    'chord-color': string;
    'display-chords': boolean;
    'display-lyrics': boolean;
    'hide-toolbar-btn': boolean;
    'observe-copyright': boolean;
    'show-fingering': boolean;
    'show-key-in-list'?: boolean;
    'song-zoom': 'vsmall' | 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge';
    'use-solfege': boolean;
    lang?: string;
    poweron: boolean;
    sidebyside: boolean;
    theme: 'light' | 'dark' | '';
}

const default_settings: Settings = {
    'chord-color': '#000000',
    'display-chords': !is_bot(), // Don't show chords by default if it is a bot
    'display-lyrics': true,
    'hide-toolbar-btn': false,
    'observe-copyright': BUILD_TYPE == 'www' ? false : true,
    'show-fingering': true,
    'song-zoom': 'medium',
    'use-solfege': false,
    poweron: false,
    sidebyside: false,
    theme: '',
};

interface SettingsStore {
    settings: Settings;
    updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

// Migration function to migrate from old persistentStorage to new Zustand store
function migrateFromPersistentStorage(): Settings {
    const migratedSettings: Settings = { ...default_settings };

    const coerceBoolean = (stored: string | undefined): boolean | undefined => {
        if (stored === 'true') return true;
        if (stored === 'false') return false;
        return undefined;
    };

    const setMigratedValue = <K extends keyof Settings>(key: K, value: Settings[K]) => {
        migratedSettings[key] = value;
    };

    // Migrate each setting from persistentStorage
    for (const setting of Object.keys(default_settings) as Array<keyof Settings>) {
        const storageKey = setting === 'observe-copyright' ? setting : `setting-${setting}`;
        const storedValue = persistentStorage.get(storageKey);

        if (storedValue !== undefined) {
            const defaultValue = default_settings[setting];

            // Coerce based on the type of the default value
            if (typeof defaultValue === 'boolean') {
                const coerced = coerceBoolean(storedValue);
                if (coerced !== undefined) setMigratedValue(setting, coerced as Settings[typeof setting]);
            } else {
                // For string types, trust the stored value (Zustand will validate on load)
                setMigratedValue(setting, storedValue as Settings[typeof setting]);
            }
        }
    }

    return migratedSettings;
}

// Custom storage adapter to work with persistentStorage
const zustandStorage = {
    getItem: (name: string): string | null => {
        return persistentStorage.get(name) || null;
    },
    setItem: (name: string, value: string): void => {
        persistentStorage.set(name, value);
    },
    removeItem: (name: string): void => {
        persistentStorage.remove(name);
    },
};

const zustandKey = 'settings-storage';
let initialSettings = default_settings;
if (!persistentStorage.get(zustandKey)) initialSettings = migrateFromPersistentStorage();

// Create the Zustand store with persistence
export const useSettingsStore = create<SettingsStore>()(
    persist(
        (set) => {
            return {
                settings: initialSettings,
                updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => {
                    set((state) => {
                        const updated: Settings = { ...state.settings };
                        updated[key] = value;
                        return { settings: updated };
                    });

                    // Handle special case for poweron setting
                    if (key === 'poweron') update_poweron();
                },
            };
        },
        {
            name: zustandKey,
            storage: createJSONStorage(() => zustandStorage),
            partialize: (state) => ({ settings: state.settings }),
        },
    ),
);

// Export a hook for individual settings
export function useSetting<K extends keyof Settings>(key: K): [Settings[K], (value: Settings[K]) => void] {
    const setting = useSettingsStore((state) => state.settings[key]);
    const updateSetting = useSettingsStore((state) => state.updateSetting);

    return [setting, (value: Settings[K]) => updateSetting(key, value)];
}

// Non-hook function to get a setting value (for use outside React components)
export function getSetting<K extends keyof Settings>(key: K): Settings[K] {
    return useSettingsStore.getState().settings[key];
}

// Non-hook function to update a setting (for use outside React components)
export function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
    useSettingsStore.getState().updateSetting(key, value);
}
