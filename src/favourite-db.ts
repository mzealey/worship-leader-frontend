import { Subject, type Subscription } from 'rxjs';
import { DB } from './db';
import { persistentStorage } from './persistent-storage.es5';

const on_favourite = new Subject<number>();

// Starring/ratings code
const _storage_key = 'favourites';

type FavouriteEntry = {
    favourite?: 0 | 1;
    rating?: number;
};

export class FavouriteDB {
    _data: Record<string, FavouriteEntry>;

    constructor() {
        this._data = persistentStorage.getObj<Record<string, FavouriteEntry>>(_storage_key, {});
    }

    _save(): void {
        // Kill empty values
        for (const song_id in this._data) if (!Object.keys(this._data[song_id] ?? {}).length) delete this._data[song_id];

        persistentStorage.setObj(_storage_key, this._data);
    }

    _get_song(song_id: number): FavouriteEntry {
        const key = String(song_id);
        if (!this._data[key]) this._data[key] = {};

        return this._data[key];
    }

    get_favourite(song_id: number): boolean {
        return !!this._get_song(song_id).favourite;
    }

    // Return an object of song ids that are favourited
    get_favourites(): Record<string, 1> {
        const ret: Record<string, 1> = {};
        for (const song_id in this._data) if (this._data[song_id]?.favourite) ret[song_id] = 1;
        return ret;
    }

    async set_favourite(song_id: number, value: boolean): Promise<void> {
        const song = this._get_song(song_id);
        song.favourite = value ? 1 : 0;
        this._save();
        on_favourite.next(song_id);

        // Update offlinedb too once we have it available to us
        const db = await DB;
        await db.set_favourite(song_id, value ? 1 : 0);
    }
    subscribe(fn: (song_id: number) => void): Subscription {
        return on_favourite.subscribe(fn);
    }

    get_rating(song_id: number): number {
        return this._get_song(song_id).rating ?? 0;
    }

    set_rating(song_id: number, score: number): void {
        const song = this._get_song(song_id);
        song.rating = score;
        this._save();
    }
}
export const FAVOURITE_DB = new FavouriteDB();
