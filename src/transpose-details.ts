import type { Subscription } from 'rxjs';
import { Subject } from 'rxjs';
import { SET_DB } from './set-db';
import { Song } from './song';
import { Transpose } from './transpose';

const trans = new Transpose();

export class TransposeDetails {
    delta = 0;
    song_id: number;
    set_id?: number;
    capo: number;
    song_capo: number;
    private _onupdate: Subject<1>;
    keyName?: string | number;
    is_minor = false;
    key?: ReturnType<typeof trans.getKeyByName>;
    startKey?: ReturnType<typeof trans.getKeyByName>;
    startKeyName?: string;

    constructor(song: Song, set_id?: number) {
        this.song_id = song.id;
        this.set_id = set_id;
        this.capo = this.song_capo = song.capo || 0;
        this._onupdate = new Subject<1>();

        let startKey = song.songkey;
        if (startKey) {
            this.keyName = startKey;
            if (startKey.charAt(startKey.length - 1) == 'm') {
                this.is_minor = true;
                startKey = startKey.substring(0, startKey.length - 1);
            }

            this.key = this.startKey = trans.getKeyByName(startKey);
            this.startKeyName = startKey; // without the m on it
        }
    }

    get_total_delta(): number {
        return (this.delta || 0) - (this.capo || 0) + (this.song_capo || 0);
    }

    update_key(key: string | number, save?: boolean) {
        // key can be the name of the key (eg 'D') or how much to transpose by (eg +5)
        this.keyName = key;
        if (save && this.set_id) SET_DB.update_song_in_set(this.set_id, this.song_id, key);

        if (typeof key === 'number') {
            this.delta = key;
        } else if (this.startKey && typeof key === 'string') {
            this.key = trans.getKeyByName(key);
            this.delta = this.key.value - this.startKey.value;
        }
        this._transposeSong();
    }

    update_capo(capo: number, save?: boolean) {
        if (save && this.set_id) SET_DB.update_song_in_set(this.set_id, this.song_id, undefined, capo);
        this.capo = capo;
        this._transposeSong();
    }

    subscribe(...args: Parameters<Subject<1>['subscribe']>): Subscription {
        return this._onupdate.subscribe(...args);
    }

    private _transposeSong() {
        this._onupdate.next(1);
    }
}
