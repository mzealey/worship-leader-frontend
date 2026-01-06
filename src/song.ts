// Base class for Song data type
export type JQueryPage = any;

export type SongSource = {
    id: number;
    lang: string;
    name: string;
    abbreviation: string;
    searchdata: string;
    sort_title: string;
    number: number;
    _type?: 'song_source';
};

export type Album = {
    id: number;
    lang: string;
    title: string;
    searchdata: string;
    sort_title: string;
    year?: number;
    purchase_path?: string;
    image_path?: string;

    _type?: 'album';
};

export type AlbumSong = {
    track?: number;
    album: Album;
};

// Minimal information for rendering a link to the song
export type RelatedSong = {
    id: number;
    title: string;
    lang: string;
    is_original: 0 | 1;
    has_chord: 0 | 1;
    has_mp3: 0 | 1;
    has_sheet: 0 | 1;
    // TODO: May be other fields?
};

export type SongInfoEntry = {
    type: string;
    value: string;
};

export type AdditionalData = unknown;

export type SongFile = {
    id: number;
    type: string;
    path: string;
    download_path?: string;
    [key: string]: AdditionalData;
};

// TODO: Convert into a class
export type Song = {
    id: number;
    lang: string;
    title: string;
    source_title: string;
    search_title: string;
    alternative_search_titles: string;
    search_text: string;
    search_meta: string;
    songxml: string;
    rating: number;
    songkey: string;
    capo: number;
    alternative_titles: string[];
    info: SongInfoEntry[];
    files: SongFile[];
    related_songs: RelatedSong[];
    song_usage: number;
    real_song_usage: number;
    song_ts: number;
    year: number;
    favourite: number;
    is_original: 0 | 1;
    copyright_restricted: 0 | 1;
    has_chord: 0 | 1;
    has_sheet: 0 | 1;
    has_mp3: 0 | 1;
    sort_title: string;

    sources: SongSource[];
    tags: number[]; // tag ids
    albums: AlbumSong[];
};

export type NotLoadedSong = {
    id: number;
    // If multiple songs requested but couldn't be instantiated for some reason then we set just this bit
    not_loaded: 1;
};

export type MaybeLoadedSong = Song | NotLoadedSong;
