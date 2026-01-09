import { get_translation } from './langpack';
import { getSetting } from './settings-store';

export function maybe_convert_solfege(val: string): string {
    if (!getSetting('use-solfege')) return val;

    return val.replace(/\b[A-GH]/g, (match) => {
        // Russian
        if (match == 'H') match = 'B';

        return get_translation('solf_' + match) || match;
    });
}
