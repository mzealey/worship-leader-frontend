import { Subject } from 'rxjs';
import type { CommonDB } from './db/common';
import { deferred_promise } from './util';

// Triggered when the languages in the database have changed, or a new database was loaded
export const on_db_languages_update = new Subject<void>();

// Triggered when the database itself changes
export const on_db_change = new Subject<void>();

// These resolved via db-init.js function, but this is needed to avoid some
// issues with circular dependencies causing load issues in the chrome build.

export let [db_available_deferred, DB_AVAILABLE] = deferred_promise<CommonDB>(); // DB object is available but may not be populated
export let [db_deferred, DB] = deferred_promise<CommonDB>(); // fully populated and ready to go

export let DB_resolved = 0; // fully populated and ready to go

// Called when switching to a new database type either at startup or
export function reset_db_fns() {
    DB_resolved = 0;

    [db_available_deferred, DB_AVAILABLE] = deferred_promise(); // DB object is available but may not be populated
    [db_deferred, DB] = deferred_promise(); // fully populated and ready to go
    DB.then(() => (DB_resolved = 1));
}

reset_db_fns();
