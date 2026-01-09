import { SET_DB, type SetEntry } from './set-db';
import { generate_search_params } from './util';

export type ShareableSet = Pick<SetEntry, 'id' | 'uuid' | 'live' | 'name' | 'songs'>;

export function generate_set_share_link(set: ShareableSet, live_share: boolean): string {
    const params: Record<string, string> = {};

    // If sharing live then the following should be enough, but in
    // order to support legacy clients or opening without an
    // internet connection we will provide a current snapshot of
    // the share before...
    if (live_share) {
        params.set_uuid = set.uuid;
        if (!set.live) SET_DB.mark_shared_live(set.id, 1);
    }

    // Add these afterwards as they sometimes corrupt the
    // parameters beforehand and js objects are usually serialized
    // in order that elements were created.
    params.new_set = set.name;
    params.song_ids = set.songs.map((song) => String(song.song_id ?? '')).join(',');
    params.keys = set.songs.map((song) => song.song_key ?? '').join(',');
    params.capos = set.songs.map((song) => (song.capo ?? '').toString()).join(',');

    return '#page-set-list?' + generate_search_params(params);
}
