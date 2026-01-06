import { Subject } from 'rxjs';
import { eventSocket } from './event-socket';
import { random_int } from './globals';
import { persistentStorage } from './persistent-storage.es5';

export type SetSong = { song_id: number; song_key?: string | number; capo?: number };

const send_set_event = eventSocket.add_queue('sets');
export const on_set_db_update = new Subject<void>();

function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        let r = random_int(16);
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

const _storage_key = 'set_data';

type IntBool = 0 | 1;

export interface SetEntry {
    live?: IntBool;
    create: number;
    update?: number;
    name: string;
    uuid: string;
    v: number;
    songs: SetSong[];
    deleted?: IntBool;
    shared_live?: IntBool;
    local?: Record<number, Partial<SetSong>>;
    ro?: IntBool;
    id: number;
    total?: number;
}

interface SetDBData {
    max_id: number;
    sets: Record<number, SetEntry>;
}

type AdjacentSongIds = { prev_id?: number; next_id?: number };

export class SetDB {
    _data: SetDBData;
    _watchers: Record<string, number>;

    constructor() {
        this._data = persistentStorage.getObj(_storage_key, {
            max_id: 1,
            sets: {},
        }) as SetDBData;

        this._watchers = {}; // guid -> set id

        Promise.race([eventSocket.is_setup(), new Promise((r) => setTimeout(r, 2000))]).then(() => {
            const now = Date.now();
            Object.values(this._data.sets)
                .filter((set) => set.live && now - set.create < 7 * 24 * 60 * 60 * 1000) // only automatically track recently created sets
                .forEach((set) => this._add_watcher(set.uuid, set.id));
        });

        // Update set lists to contain new data. Remove in Jan 2020
        const to_update = Object.values(this._data.sets).filter((set) => !set.uuid);
        if (to_update.length) {
            to_update.forEach((set) => {
                set.uuid = generateUUID();

                // create still monatonically increasing but low number means we can probably figure out if it was old or new version
                set.create = set.id;
                set.v = 0;
            });
            this._save_changed_sets(to_update);
        }
    }

    _save_sets(): void {
        persistentStorage.setObj(_storage_key, this._data);
        on_set_db_update.next();
    }

    async _watch_live_set(set_uuid: string, v = 0): Promise<SetEntry | void | null> {
        // As set uuids are unique and copied from the original shared set
        // there should only ever be one of these in the local set database.
        // Signal a duplicate add attempt by an empty resolved promise.
        if (this._watchers[set_uuid]) return;

        return new Promise((resolve) => {
            const callback = (res: SetEntry | null) => {
                resolve(res);
                const set_id = this._watchers[set_uuid];
                if (!res || !set_id) return;

                // was definately something to update in the set - first connect
                // will always return at least the v key to show it has received
                // the subscription, but wont return data unless it has changed.
                const set = this._get_set(set_id);
                if (set && res.songs) {
                    set.name = res.name;
                    set.v = res.v;
                    set.songs = res.songs;
                }

                this._save_sets();
            };
            eventSocket.register_listener(`sets/${set_uuid}`, callback, { v });
        });
    }

    _create_set(name: string, uuid = generateUUID(), v = 0, songs: SetSong[] = []): SetEntry {
        const set_id = this._data.max_id++;
        this._data.sets[set_id] = {
            id: set_id,
            name,
            uuid,
            create: Date.now(),
            v,
            songs,
        };
        return this._data.sets[set_id];
    }

    _add_watcher(set_uuid: string, set_id: number): void {
        if (!this._watchers[set_uuid]) {
            const set = this._get_set(set_id);
            if (set) this._watch_live_set(set_uuid, set.v);
        }
        this._watchers[set_uuid] = set_id;
    }

    _remove_watcher(set: SetEntry): void {
        if (!set.live || !this._watchers[set.uuid]) return;

        eventSocket.unregister_listener(`sets/${set.uuid}`);
        delete this._watchers[set.uuid];
    }

    async create_live_set(set_uuid: string): Promise<number> {
        const existing = this._get_set_by_uuid(set_uuid);
        if (existing) return existing.id;

        const res = await this._watch_live_set(set_uuid);

        // If no res then there was already a set with this uuid, find and return it
        if (!res) return this._watchers[set_uuid];

        const set = this._create_set(res.name, set_uuid, res.v, res.songs);
        this._add_watcher(set_uuid, set.id);

        // In the future we may wish to make live sets read/write in
        // some cases, but distributed multi-writer is much more
        // complex.
        set.live = 1;
        set.ro = 1;
        this._save_sets();
        return set.id;
    }

    _get_set_by_uuid(set_uuid: string): SetEntry | undefined {
        // Not very efficient algo but shouldn't matter.
        return Object.values(this._data.sets).find((set) => set.uuid == set_uuid);
    }

    _get_set(set_id: number): SetEntry | null {
        const set = this._data.sets[set_id];
        return set && !set.deleted ? set : null;
    }

    async create_set(name: string): Promise<number> {
        const set = this._create_set(name);
        this._save_sets();
        return set.id;
    }

    async find_adjacent_songids_in_set(set_id: number, song_id: number): Promise<AdjacentSongIds> {
        let ret: AdjacentSongIds = {};

        let details = this.find_song_position_in_set(set_id, song_id);
        if (details) {
            let set = details.set;

            if (details.position > 0) ret.prev_id = set.songs[details.position - 1].song_id;

            if (details.position + 1 < set.songs.length) ret.next_id = set.songs[details.position + 1].song_id;
        }

        return ret;
    }

    async get_song_set_details(set_id: number, song_id: number) {
        const details = this._find_song_in_set(set_id, song_id);
        if (!details) return;

        const song = { ...details.song };
        if (details.set.local && details.set.local[song_id]) Object.assign(song, details.set.local[song_id]);
        return song;
    }

    _find_song_in_set(set_id: number, song_id: number) {
        const set = this._get_set(set_id);
        if (!set) return;

        for (let i = 0; i < set.songs.length; i++) {
            if (set.songs[i].song_id == song_id)
                return {
                    set,
                    song: set.songs[i],
                };
        }

        return;
    }

    find_song_position_in_set(set_id: number, song_id: number) {
        const set = this._get_set(set_id);
        if (!set) return;

        for (let i = 0; i < set.songs.length; i++)
            if (set.songs[i].song_id == song_id)
                return {
                    set,
                    position: i,
                };

        return;
    }

    async add_song_to_set(set_id: number, song_id: number, song_key?: string | number, capo?: number) {
        return this.add_songs_to_set(set_id, [{ song_id, song_key, capo }]);
    }

    async add_songs_to_set(set_id: number, songs: SetSong[]) {
        const set = this._get_set(set_id);
        if (!set || set.ro) throw 'Set not writable';

        let p: Promise<void> = Promise.resolve();
        songs.forEach((song) => {
            const details = this._find_song_in_set(set_id, song.song_id);
            if (details) {
                // already exists
                p = Promise.reject();
                return;
            }

            // TODO: Validate the song before adding
            const normalized: SetSong = {
                song_id: song.song_id,
                song_key: song.song_key,
                capo: song.capo,
            };
            set.songs.push(normalized);
        });

        this._set_changed(set);
        return p;
    }

    update_song_in_set(set_id: number, song_id: number, song_key?: string | number, capo?: number) {
        const details = this._find_song_in_set(set_id, song_id);
        if (details) {
            const { set, song } = details;
            const updater = (item: Partial<SetSong>) => {
                if (song_key !== undefined) item.song_key = song_key;
                if (capo !== undefined) item.capo = capo;
            };

            if (set.live) {
                // store local info with a song if set is live
                if (!set.local) set.local = {};
                if (!set.local[song_id]) set.local[song_id] = {};
                const local = set.local[song_id] as Partial<SetSong>;
                updater(local);

                // If the capo/key has been set to the same as in the set then just revert it to follow the set
                (Object.keys(local) as (keyof SetSong)[]).forEach((item) => {
                    if (song[item] === local[item]) delete local[item];
                });

                this._save_set_local_info(set);
            } else if (!set.ro) {
                updater(song);
                this._set_changed(set);
            }
        }
    }

    async get_set_list(): Promise<SetEntry[]> {
        const ret = Object.values(this._data.sets)
            .filter((set) => !set.deleted)
            .sort((a, b) => (b.update || b.create) - (a.update || a.create)) // Reverse the order (ie most recently updated first)
            .map((set) => ({ ...set, total: set.songs.length }));

        return ret;
    }

    // Throws if not found
    async get_set(set_id: number): Promise<SetEntry> {
        const set = this._get_set(set_id);
        if (set && set.live)
            // Ensure we are up to date if not watched already
            this._add_watcher(set.uuid, set.id);
        if (set) return set;

        throw undefined;
    }

    mark_shared_live(set_id: number, shared_live: IntBool = 1): void {
        const set = this._get_set(set_id);
        if (set) set.shared_live = shared_live;
    }

    get_set_title(set_id: number) {
        return this.get_set(set_id).then((set) => set.name);
    }

    get_songs(set_id: number): SetSong[] {
        const set = this._get_set(set_id);
        return set ? set.songs : [];
    }

    delete_set(set_id: number): void {
        const set = this._get_set(set_id);
        if (!set) return;

        if (set.live) this._remove_watcher(set);

        if (set.ro) {
            delete this._data.sets[set_id];
            this._save_sets();
        } else {
            set.deleted = 1;
            this._set_changed(set);
        }
    }

    async rename_set(set_id: number, name: string) {
        const set = this._get_set(set_id);
        if (set?.ro) throw 'Cannot rename a read-only set';

        if (set) {
            set.name = name;
            this._set_changed(set);
        }
    }

    delete_song_from_set(song_id: number, set_id: number): void {
        const details = this.find_song_position_in_set(set_id, song_id);
        if (details) {
            if (details.set.ro) return;

            details.set.songs.splice(details.position, 1);
            this._set_changed(details.set);
        }
    }

    update_set_db_order(set_id: number, id_order: number[]): void {
        const set = this._get_set(set_id);
        if (!set || set.ro) return;

        const songsMap: Record<number, SetSong> = {};
        for (const item of set.songs) songsMap[item.song_id] = item;

        set.songs = id_order.map((id) => songsMap[id]).filter((song): song is SetSong => !!song);

        this._set_changed(set);
    }

    _set_changed(set: SetEntry): void {
        if (set.ro) throw 'Calling set_changed on a ro set';

        set.v++; // Increment version counter
        set.update = Date.now();
        this._save_changed_sets([set]);
    }

    _save_changed_sets(sets: SetEntry[]): void {
        sets.filter((set) => !set.ro).forEach((set) => {
            const save_set = { ...set };
            delete save_set.local; // dont save local data to the server
            send_set_event(save_set, set.uuid); // Only ever queue the latest of a given uuid to submit to the server

            if (set.deleted)
                // Remove locally now synced to server
                delete this._data.sets[set.id];
        });

        this._save_sets();
    }

    _save_set_local_info(set: SetEntry): void {
        if (!set.live) throw 'Calling _save_set_local_info on a normal set';
        this._save_sets();
    }
}
export const SET_DB = new SetDB();
