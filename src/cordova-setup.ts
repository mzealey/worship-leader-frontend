import { get_client_type } from './globals';
import { update_poweron } from './settings';
import { change_location_from_intent, set_start_location, set_start_question } from './startup';
import { is_cordova } from './util';

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
        if (get_client_type() == 'ios' && cordova.plugins && cordova.plugins.printer) {
            cordova.plugins.printer.canPrintItem(function (available /*, count */) {
                $('#print-btn').toggle(!!available);
            });
        }

        // Cordova link passed through by intent
        if (window.universalLinks) {
            window.universalLinks.subscribe('applaunch', function (data) {
                let new_location;
                if (data.params.song_id) new_location = '#songinfo?song_id=' + data.params.song_id;
                else if (data.hash) new_location = '#' + data.hash;

                set_start_question(data.params.q);
                set_start_location(new_location);
                change_location_from_intent(new_location);
            });
        }
    });
}
