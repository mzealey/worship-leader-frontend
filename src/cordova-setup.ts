import { useCanPrint } from './can-print';
import { get_client_type } from './globals';
import { set_search_text } from './search';
import { getSetting } from './settings-store';
import { is_cordova } from './util';

export function update_poweron() {
    if (is_cordova() && window.plugins && window.plugins.insomnia) {
        if (getSetting('poweron')) window.plugins.insomnia.keepAwake();
        else window.plugins.insomnia.allowSleepAgain();
    }
}

export function cordova_setup() {
    if (!is_cordova()) return;

    // Cordova startup. Only triggered if we are in cordova
    document.addEventListener('deviceready', () => {
        console.log('deviceready');
        update_poweron();

        // NOTE: Android will return not available if no printers have been
        // configured, but you might want to print to PDF or something...
        //
        // iOS correctly returns available if any print system is available
        if (get_client_type() == 'ios' && cordova.plugins && cordova.plugins.printer)
            cordova.plugins.printer.canPrintItem((available: boolean) => useCanPrint.getState().set(!!available));

        // Cordova link passed through by intent
        if (window.universalLinks) {
            window.universalLinks.subscribe('applaunch', (data: { params: Record<string, string>; hash?: string }) => {
                if (data.params.q) set_search_text(data.params.q);

                let new_location;
                if (data.params.song_id) new_location = 'song/' + data.params.song_id;
                else if (data.hash) new_location = data.hash;

                if (new_location) window.location.hash = '#' + new_location;
            });
        }
    });
}
