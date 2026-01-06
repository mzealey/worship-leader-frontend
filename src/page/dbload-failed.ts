import { DB_AVAILABLE } from '../db';

export function init_dbload_failed() {
    const page = $('#page-dbload-failed');
    page.on('pageinit', () => {
        page.find('.ui-btn').click(() => {
            $.mobile.changePage('#page-initializing', {
                reverse: false,
                changeHash: false,
            });

            // Re-attempt to populate the database
            DB_AVAILABLE.then((db) => db.populate_db());
        });
    });
}
