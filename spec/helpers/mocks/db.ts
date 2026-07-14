export function createDbMock() {
    return {
        DB_AVAILABLE: Promise.resolve({
            ideal_debounce: () => 250,
        }),
        DB: Promise.resolve({
            type: () => 'offline',
            get_song_sources: () => Promise.resolve([]),
        }),
        on_db_languages_update: { subscribe: () => ({ unsubscribe: () => {} }) },
    };
}
