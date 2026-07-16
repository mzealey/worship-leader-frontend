import { vi } from 'vitest';

export function createSettingsStoreMock(overrides: Record<string, unknown> = {}) {
    return {
        useSetting: (setting: string) => {
            const defaults: Record<string, unknown> = {
                'display-lyrics': true,
                'display-chords': true,
                'chord-color': [255, 0, 0],
                theme: '',
                'song-zoom': 'medium',
                'observe-copyright': true,
            };

            return [overrides[setting] ?? defaults[setting] ?? undefined, vi.fn()];
        },
        updateSetting: vi.fn(),
    };
}
