import { SET_DB } from './set-db';

function split_comma(str?: string): string[] {
    if (!str)
        // older version of client did not have eg keys/capos
        return [];

    // In some cases we get stuff double- or tripple-encoded (ie %252C) for
    // some reason so decode that if it looks like that was the case
    while (/%2C/i.test(str) && !/,/.test(str)) str = decodeURIComponent(str);

    return str.split(/,/);
}

export interface CreateSetOptions {
    set_uuid?: string;
    new_set?: string;
    keys?: string;
    capos?: string;
    song_ids?: string;
}

// Given a dictionary parsed from a url's search parameters, create a new set
// and go to it.
let last_set_add = 0;
export async function create_set_from_url(opts: CreateSetOptions): Promise<number> {
    // Debounce any open/paste type events so we only add one set
    if (Date.now() - last_set_add < 100) throw new Error('Debounced');

    last_set_add = Date.now();

    let set_id: number;
    if (opts.set_uuid)
        // live set, ignore any other parameters as they are for backwards-compatibility
        set_id = await SET_DB.create_live_set(opts.set_uuid);
    else {
        set_id = await SET_DB.create_set(opts.new_set ?? '');
        // populate set
        const keys = split_comma(opts.keys);
        const capos = split_comma(opts.capos);
        const song_details = split_comma(opts.song_ids).map((song_id, i) => ({ song_id: Number(song_id), song_key: keys[i], capo: Number(capos[i]) }));

        await SET_DB.add_songs_to_set(set_id, song_details);
    }

    return set_id;
}
