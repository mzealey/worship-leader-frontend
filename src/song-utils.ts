import type { Song } from './song';

export function get_text_title(song: Pick<Song, 'title' | 'source_title'>): string {
    let title = song.title;
    if (song.source_title) title += ` (${song.source_title})`;
    return title;
}
