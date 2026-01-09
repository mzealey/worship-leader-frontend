import { SET_DB, type SetSong } from './set-db';

type SetContext = unknown;

export class SetSwitcher {
    public readonly set_id: number;
    public songs: SetSong[];
    private song_id: number;
    private details: { position: number; set?: SetContext } = { position: -1 };

    constructor(set_id: number, song_id: number) {
        this.set_id = set_id;
        this.songs = SET_DB.get_songs(set_id);
        this.song_id = song_id;
        this.cur_song_id(song_id);
    }

    cur_song_id(song_id: number): void {
        this.song_id = song_id;

        // If someone removes the song from the set, set position as -1 so that
        // we go back to the beginning on the next song, but maintaing the
        // removed one as currently displayed.
        this.details = SET_DB.find_song_position_in_set(this.set_id, this.song_id) || { position: -1 };
    }

    position(): number {
        return this.details.position;
    }

    can_prev(): boolean {
        return this.position() > 0;
    }
    can_next(): boolean {
        return this.position() < this.songs.length - 1;
    }
    move(amount: number): number {
        let new_pos = this.position() + amount;
        if (this.songs.length === 0) return this.song_id;

        if (new_pos < 0) new_pos = 0;
        else if (new_pos > this.songs.length - 1) new_pos = this.songs.length - 1;

        return this.songs[new_pos]?.song_id ?? this.song_id;
    }
}
