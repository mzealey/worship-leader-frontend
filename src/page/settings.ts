import { update_help_toolbars } from '../component/help';
import { lock_screen_percentage } from '../component/lock-screen';
import { spinner } from '../component/spinner';
import { DB, DB_AVAILABLE } from '../db';
import { switch_db_api } from '../db-init';
import { enter_cast_mode } from '../dual-present';
import { eventSocket } from '../event-socket';
import { get_client_type, get_uuid } from '../globals';
import { refresh_selectmenu } from '../jqm-util';
import { app_lang, get_language_options, lang_setup, langpack_loaded } from '../langpack';
import { get_meta_db_update_ts } from '../meta-db';
import { persistentStorage } from '../persistent-storage.es5';
import { do_new_search } from '../search';
import { get_setting, is_set, update_setting } from '../settings';
import { is_cordova } from '../util';
import { get_song_list_page } from './search-helpers';

export function init_settings() {
    const page = $('#page-settings');
    page.on('pagebeforeshow', update_db_version_string);

    page.on('pageinit', () => {
        page.find('#button-reloaddb').on('click', () => {
            lock_screen_percentage(async (progress_tracker) => {
                try {
                    const db = await DB;
                    await db.refresh_languages(false, true, progress_tracker);
                    $('#dbreload-success').popup('open', { history: false });
                } catch (e) {
                    $('#dbreload-failed').popup('open', { history: false });
                }
                update_db_version_string();
            });
        });

        const db_type = page.find('#setting-db');
        DB_AVAILABLE.then((db) => {
            db_type.val(db.type());
            refresh_selectmenu(db_type);
        });
        db_type.on('change', () => {
            spinner(switch_db_api(db_type.val() == 'offline', true).then(() => update_db_version_string()));
        });

        page.find('#refresh-cast').on('click', () => enter_cast_mode());

        // Only available on some platforms
        if (!(is_cordova() && window.plugins && window.plugins.insomnia)) $('#setting-poweron-group').remove();

        Promise.all([get_language_options(), langpack_loaded()]).then(
            ([options]) => {
                let select = page.find('#setting-lang');
                select.append(...options);

                select
                    .change(function () {
                        lang_setup($(this).val() as string);
                        update_setting(this.id, app_lang());
                    })
                    .val(app_lang());
                refresh_selectmenu(select);
            },
            () => page.find('#setting-lang').parent().hide(),
        ); // couldn't load ?

        function checkbox_storage_update(element) {
            update_setting(element.id, element.checked ? 'true' : 'false');
        }

        // init the settings from database otherwise use their default values
        page.find('input[type=checkbox]').each((i, elem) => {
            const e = elem as HTMLInputElement;
            e.checked = is_set(e.id);
            $(e).checkboxradio('refresh');
        });

        page.on('change', 'input[type=checkbox]', function () {
            checkbox_storage_update(this);
        });

        let zoom = page
            .find('#setting-song-zoom')
            .val(get_setting('setting-song-zoom'))
            .change(function () {
                update_setting(this.id, $(this).val());
            });
        refresh_selectmenu(zoom);

        function update_chord_visibility(elem: HTMLInputElement) {
            let chords = $('#setting-display-chords') as JQuery<HTMLInputElement>;
            $('#container-display-chords, #container-sidebyside').toggle(elem.checked);
            update_chord_color_visibility(elem.checked && chords[0].checked);
        }

        function update_chord_color_visibility(display: boolean) {
            $('#setting-chord-color-group, .container-chord-only').toggle(display);
        }

        $('#setting-display-lyrics').change(function () {
            update_chord_visibility(this as HTMLInputElement);
        });
        $('#setting-display-chords').change(function () {
            update_chord_color_visibility((this as HTMLInputElement).checked);
        });
        $('#setting-chord-color').colorPicker({
            pickerDefault: get_setting('setting-chord-color'),
            onColorChange(id, newValue) {
                update_setting('setting-chord-color', newValue);
            },
        });
        $('.colorPicker-picker').addClass('ui-icon ui-icon-shadow');
        $('.colorPicker_hexWrap').remove();

        $('#setting-chord-color-group a').click(function () {
            $.fn.colorPicker.togglePalette($('#colorPicker_palette-0'), $('.colorPicker-picker'));
        });

        update_chord_visibility($('#setting-display-lyrics')[0] as HTMLInputElement);

        // hook these to bubble event so they gets triggered after checkbox_storage_update above
        page.on('change', '#setting-hide-toolbar-btn', update_toolbar_text_visibility);
        page.on('change', '#setting-show-help', () => update_help_toolbars());
        page.on('change', '#setting-show-key-in-list', () => do_new_search(get_song_list_page(), true));
    });
}

export function update_toolbar_text_visibility() {
    $('html').toggleClass('no-header-btn-text', is_set('setting-hide-toolbar-btn'));
}

function date_as_utc(date) {
    try {
        return date.toLocaleString(undefined, { timeZone: 'UTC' });
    } catch (e) {
        return date.toString();
    }
}

function update_db_version_string() {
    let lines = [
        `persistent storage: ${persistentStorage.type()}`,
        `code: ${get_uuid()}`,
        `client: ${get_client_type()}`,
        `version: ${APP_VERSION}`,
        `build: ${BUILD_TYPE}`,
        `current ts: ${date_as_utc(new Date())}`,
        `meta ts: ${date_as_utc(new Date(get_meta_db_update_ts()))}`,
        `offline status: ${navigator.onLine ? 'online' : 'offline'}`,
        `event socket: ${eventSocket.type()}`,
    ];
    DB_AVAILABLE.then((db) => {
        lines.push(db.get_version_string());
        if (db.db_load_errs) lines.push('db load errors: ' + db.db_load_errs);
        $('#setting-info').html(lines.join('<br>'));
    });

    $('#setting-info').html(lines.join('<br>'));
}
