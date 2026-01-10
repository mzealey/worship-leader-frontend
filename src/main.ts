import './main.scss';

import { send_error_report, setup_error_catcher } from './error-catcher';
setup_error_catcher();

// External libraries
import 'jquery-ui/ui/widget';
import 'jquery-ui/ui/widgets/mouse';
import 'jquery-ui/ui/widgets/sortable';
import 'raty-js/lib/jquery.raty.js';
import '../js/jquery.colorPicker.min.js';

// Order is important here
import 'jquery-ui-touch-punch'; // must be loaded after mouse

import { persistentStorage } from './persistent-storage.es5';

// Stuff that needs initing
import { setup_abc2svg } from './abc2svg';
import { maybe_setup_ga } from './analytics';
import { setup_audio_player } from './component/audio-player';
import { init_casting } from './component/dual-present';
import { init_help } from './component/help';
import { init_page_localization } from './component/page-localization';
import { init_pagers } from './component/pager';
import { init_sheet_music } from './component/score';
import { setup_tristate_fns } from './component/tristate';
import { cordova_setup } from './cordova-setup';
import { init_db } from './db-init';
import { setup_feedback_sender } from './feedback-sender';
import { init_filter_sources } from './filter-sources';
import { init_add_to_set } from './page/add-to-set';
import { init_copy_page } from './page/copy';
import { init_db_langs } from './page/db-langs';
import { init_dbload_failed } from './page/dbload-failed';
import { init_present_dialog } from './page/dialog-present';
import { init_dialog_set_delete } from './page/dialog-set-delete';
import { init_dialog_set_rename } from './page/dialog-set-rename';
import { init_dialog_set_share } from './page/dialog-set-share';
import { init_edit_page } from './page/edit';
import { init_firsttime_welcome } from './page/firsttime-welcome';
import { init_list } from './page/list';
import { init_page_print_songbook } from './page/page-print-songbook';
import { init_search } from './page/search';
import { init_set_list } from './page/set-list';
import { init_set_view } from './page/set-view';
import { init_settings, update_toolbar_text_visibility } from './page/settings';
import { init_sharer } from './page/sharer';
import { init_songinfo, setup_track_prints } from './page/songinfo';
import { init_source_select } from './page/source-select';
import { init_tag_select } from './page/tag_select';
import { load_song_languages } from './song-languages';
import { jqm_startup } from './startup';
import { is_touch_device } from './util';

function update_usage_counter() {
    persistentStorage.setObj('uses', persistentStorage.getObj('uses', 0) + 1);
}

function main_setup() {
    if (is_touch_device()) $('html').addClass('touch');

    let setup_fns = [
        // Key init functions
        cordova_setup,
        update_usage_counter,
        jqm_startup,
        init_db,

        load_song_languages,

        // Set up some other services
        setup_tristate_fns,
        setup_feedback_sender,
        setup_audio_player,
        init_filter_sources,

        init_casting,

        // set up the pages
        init_page_localization,
        init_help,
        init_pagers,
        init_songinfo,
        init_dialog_set_rename,
        init_add_to_set,
        init_set_list,
        init_dialog_set_delete,
        init_dialog_set_share,
        init_page_print_songbook,
        init_present_dialog,
        init_set_view,
        init_tag_select,
        init_source_select,
        init_search,
        init_dbload_failed,
        init_list,
        init_sharer,
        init_settings,
        init_firsttime_welcome,
        init_db_langs,
        init_edit_page,
        init_copy_page,
        init_sheet_music,

        // Any other fns that need calling
        setup_track_prints,
        setup_abc2svg,
        update_toolbar_text_visibility,
    ];

    // Catch and report any setup issues
    setup_fns.forEach((fn) => {
        try {
            fn();
        } catch (e) {
            send_error_report('startup', e);
        }
    });

    // On load maybe include analytics but after everything else has been set up
    setTimeout(maybe_setup_ga, 2000);
}

main_setup();
