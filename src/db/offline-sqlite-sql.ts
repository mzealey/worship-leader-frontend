// SQL for SQLite database which may be used in several different places
export const SQL = {
    add_dbmeta_sources: 'INSERT OR REPLACE INTO song_source_info (id, lang, name, abbreviation, searchdata, sort_title) VALUES (?,?,?,?,?,?)',
    add_dbmeta_albums: 'INSERT OR REPLACE INTO albums (id, lang, searchdata, data) VALUES (?,?,?,?)',

    add_song_song: `
        INSERT INTO songs(
            id, lang, title, source_title, songxml, songkey, capo,
            alternative_titles, related_songs,
            info, files,
            song_usage, rating, real_song_usage,
            song_ts, favourite, search_title, alternative_search_titles, search_text, search_meta, sort_title, is_original,
            copyright_restricted, has_mp3, has_sheet, has_chord,
            year
        ) VALUES (
            ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
        )
        ON CONFLICT(id) DO UPDATE SET
            lang = excluded.lang,
            title = excluded.title,
            source_title = excluded.source_title,
            songxml = excluded.songxml,
            songkey = excluded.songkey,
            capo = excluded.capo,
            alternative_titles = excluded.alternative_titles,
            related_songs = excluded.related_songs,
            info = excluded.info,
            files = excluded.files,
            song_usage = excluded.song_usage,
            rating = excluded.rating,
            real_song_usage = excluded.real_song_usage,
            song_ts = excluded.song_ts,
            favourite = excluded.favourite,
            search_title = excluded.search_title,
            alternative_search_titles = excluded.alternative_search_titles,
            search_text = excluded.search_text,
            search_meta = excluded.search_meta,
            sort_title = excluded.sort_title,
            is_original = excluded.is_original,
            copyright_restricted=excluded.copyright_restricted,
            has_mp3 = excluded.has_mp3,
            has_sheet = excluded.has_sheet,
            has_chord = excluded.has_chord,
            year = excluded.year
        `,

    add_song_album: 'INSERT OR IGNORE INTO album_songs (song_id, album_id, track) VALUES (?,?,?)',
    add_song_source: 'INSERT OR REPLACE INTO song_source (song_id, song_source_info_id, number) VALUES (?,?,?)',
    add_song_tag: 'INSERT OR REPLACE INTO song_tags (song_id, tag_id) VALUES (?,?)',
};
