import { DB_AVAILABLE, db_available_deferred, db_deferred, on_db_change, on_db_languages_update, reset_db_fns } from './db';
import type { CommonDB } from './db/common';
import { get_db_chosen_langs, save_db_chosen_langs } from './db/common';
import { OfflineDBCommon } from './db/offline-common';
import { OnlineDB } from './db/online';
import { get_browser_languages } from './langdetect.es5';
import { refresh_search_all_pages } from './page/search';
import { persistentStorage } from './persistent-storage.es5';
import { is_bot } from './splash-util.es5';
import { is_cordova, timeout } from './util';

// TODO: Only include in phonegap builds
import { OfflineWebSQLDB } from './db/offline-sqlite-websql';

// TODO: Only include in browser builds
import { OfflineWASMDB, supports_browser_sqlite, try_load_sqlite_wasm } from './db/offline-sqlite-wasm';

import { FAVOURITE_DB } from './favourite-db';
import { firsttime_shown } from './startup-promises';

let supports_cordova_sqlite: boolean | undefined;
export function may_support_offline() {
    return supports_cordova_sqlite || supports_browser_sqlite;
}

const SETTING_DB_KEY = 'saved-setting-db';

async function _init_db() {
    // We can only figure this out after deviceready has fired on cordova
    supports_cordova_sqlite = !!(is_cordova() && window.sqlitePlugin && window.sqlitePlugin.openDatabase);

    if (may_support_offline()) $('html').toggleClass('supports-offline');

    on_db_change.subscribe(async () => {
        const db = await DB_AVAILABLE;

        // Update the UI with info from the new DB when it's been setup correctly
        $('html')
            .removeClass((_, classes) => (classes.match(/\bdb-\S+/) || []).join(' '))
            .addClass('db-' + db.type());

        refresh_search_all_pages(1);
        // Only some browsers support .hide() for these.
        $('select option.offline-db-only').prop('disabled', db.type() == 'online');
    });

    await switch_db_api();
}

export async function switch_db_api(try_offline_db?: boolean, save_setting?: boolean): Promise<CommonDB> {
    // Reset the database promises to allow switching
    if (save_setting) {
        reset_db_fns();
    }

    // Auto-detect whether to try offline db or not
    if (try_offline_db === undefined) {
        try_offline_db = true;

        // Bots should always use online db.
        if (is_bot()) try_offline_db = false;

        // User explicitly set this in settings
        if (persistentStorage.get(SETTING_DB_KEY) == 'online') try_offline_db = false;
    }

    let db_load_errs = '';

    let DB_API: CommonDB | undefined;
    if (try_offline_db) {
        if (!DB_API && supports_cordova_sqlite) {
            try {
                let db = window.sqlitePlugin.openDatabase({ name: 'songs', location: 'default' });
                if (db) DB_API = new OfflineWebSQLDB(FAVOURITE_DB, db);
            } catch (e) {
                db_load_errs += `sqlitePlugin open err ${e}; `;
                console.error('sqlitePlugin open err', e);
            }
        }

        // Try wasm if possible - may hang for up to 5 seconds if there was a bad problem with loading, but caching should
        // fix this generally
        if (!DB_API && supports_browser_sqlite) {
            try {
                const db = await timeout(try_load_sqlite_wasm(), 5000);
                if (db) DB_API = new OfflineWASMDB(FAVOURITE_DB, db);
            } catch (e) {
                db_load_errs += `sqliteWasm open err ${e}; `;
                console.error('sqliteWasm open err', e);
            }
        }
    }

    // Last fallback - use online API
    if (!DB_API) DB_API = new OnlineDB(FAVOURITE_DB);

    // FIXME: Set up the results callback (to stop circular deps)
    DB_API.db_load_errs = db_load_errs;

    // Generally we want to auto-try, only save the setting if we are being explicitly switched
    if (save_setting) persistentStorage.set(SETTING_DB_KEY, DB_API.type());

    // Database interface is now available, but not yet initialized
    db_available_deferred.resolve(DB_API);

    // Run the base initialization in the background rather than awaiting to speed things up
    DB_API.initialize_db();

    // Handle any DB initialization after the firsttime page has been shown as
    // it may require showing a page to download database languages.
    firsttime_shown.then(async () => {
        // If we are on an older version of the app where the chosen languages were only stored in the database,
        // attempt to migrate that over to the new format.
        // Remove after Jul 2026
        let existingLangSelection = get_db_chosen_langs();
        if (!existingLangSelection.length && DB_API instanceof OfflineDBCommon) {
            const langs = await DB_API.list_loaded_langs();
            if (langs.length) save_db_chosen_langs(langs);
        }

        // If we were called from a bot or direct from the web, then don't prompt the user for language selection;
        // rather pull a default list from the browser and set it to that, and assume that we will fall-through to
        // online db
        if (!get_db_chosen_langs().length && is_bot()) save_db_chosen_langs(get_browser_languages());

        if (!get_db_chosen_langs().length) {
            // Default case on first load is to show db-langs page so user can select them. Once the languages are
            // selected, populate_db() will be called from that page and app initialization sequence will continue.
            $.mobile.changePage('#page-db-langs', { reverse: false });
        } else {
            // We know what languages have been chosen by the user, just make sure that the selected database has them
            // all loaded appropriately.
            await DB_API.db_initialized;

            // Populate the database in the background so that we don't block the UI
            await DB_API.populate_db(true);
        }
    });

    if (DEBUG) window.DB_API = DB_API;

    // Add in debugging for mark on clients
    window.kill_db = function () {
        DB_API.kill_db();
        persistentStorage.clear();
    };

    // Wait until the new database has loaded and initialized - this is triggered from the app initialization code if
    // it doesn't prompt the user for language selection
    await DB_API.db_populated;

    // Fully loaded database is now available and you can do whatever you want with it
    db_deferred.resolve(DB_API);

    on_db_languages_update.next();
    on_db_change.next();

    return DB_API;
}

export function init_db() {
    if (BUILD_TYPE == 'phonegap') {
        // The cordova sqlite plugin has to be executed after cordova has been set up
        document.addEventListener('deviceready', _init_db);
    } else {
        // Fake it for testing purposes if you want...
        //setTimeout(_setup_db_api, 2000);
        _init_db();
    }
}

if (DEBUG) window.switch_db_api = switch_db_api;
