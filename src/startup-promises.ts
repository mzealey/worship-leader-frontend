// These need to be a separate file to avoid circular deps on startup.js if
// they were mostly defined there.

import { DB } from './db';
import { deferred_promise } from './util';

const [_jqm_setup, jqm_setup] = deferred_promise<void>();
export { jqm_setup };
export function jqm_setup_completed() {
    _jqm_setup.resolve();
}

export const [firsttime_shown_deferred, firsttime_shown] = deferred_promise<void>();

// A promise indicating that the app is all good to go. Discard promise return
// values via map statement so we don't hold objects in memory (for example the
// DB reference).
export const app_inited = Promise.all([jqm_setup, firsttime_shown, DB].map((p) => p.then(() => 1)));
let _is_setup = 0;
app_inited.then(() => (_is_setup = 1));

export const is_setup = () => _is_setup;
