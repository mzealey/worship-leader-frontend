import * as fs from 'fs/promises';
import * as path from 'path';
import type { DBRequestedItems, DBSearchRunResult } from '../../src/db-search';
import type { DBBaseFilters, DBFilters } from '../../src/db/common';
import { recursive_decompress } from '../../src/db/compressed-key-map';
import type { Album, Song, SongShortData, SongSource } from '../../src/song';

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures');

interface FixtureContainer {
    data: Record<string, any>[];
}

interface MetaDbFixture {
    tag_mappings: Record<string, { id: number; tag_code: string; tag_group: string }>;
}

async function loadFixture(filename: string): Promise<any> {
    const filePath = path.join(FIXTURES_DIR, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
}

function fixtureSongToSong(raw: Record<string, any>): Song {
    const decompressed = recursive_decompress(raw) as Record<string, any>;

    return {
        id: decompressed.id as number,
        lang: (decompressed.lang || 'en') as string,
        title: (decompressed.title || decompressed.search_title || '') as string,
        alternative_titles: (decompressed.alternative_titles as string[]) || [],
        copyright_restricted: (decompressed.copyright_restricted || 0) as 0 | 1,
        source_title: (decompressed.source_title || '') as string,
        is_original: (decompressed.is_original || 0) as 0 | 1,
        has_chord: (decompressed.has_chord || 0) as 0 | 1,
        has_sheet: (decompressed.has_sheet || 0) as 0 | 1,
        has_mp3: (decompressed.has_mp3 || 0) as 0 | 1,
        search_title: (decompressed.search_title || decompressed.title || '') as string,
        alternative_search_titles: (decompressed.alternative_search_titles || '') as string,
        search_text: (decompressed.search_text || '') as string,
        search_meta: (decompressed.search_meta || '') as string,
        songxml: (decompressed.songxml || '') as string,
        rating: (decompressed.rating || 0) as number,
        songkey: (decompressed.songkey || '') as string,
        capo: (decompressed.capo || 0) as number,
        info: (decompressed.info || []) as any[],
        files: (decompressed.files || []) as any[],
        related_songs: (decompressed.related_songs || []) as any[],
        song_usage: (decompressed.song_usage || 0) as number,
        real_song_usage: (decompressed.real_song_usage || 0) as number,
        song_ts: (decompressed.song_ts || 0) as number,
        year: (decompressed.year || 0) as number,
        favourite: (decompressed.favourite || 0) as number,
        sort_title: (decompressed.sort_title || decompressed.title || '') as string,
        sources: [],
        tags: ((decompressed.tags || []) as any[]).map((tag: any) => (typeof tag === 'object' ? tag.i || tag.id : tag)),
        albums: [],
    };
}

function songToShortData(song: Song): SongShortData {
    return {
        id: song.id,
        lang: song.lang,
        title: song.title,
        alternative_titles: song.alternative_titles,
        copyright_restricted: song.copyright_restricted,
        source_title: song.source_title,
        is_original: song.is_original,
        has_chord: song.has_chord,
        has_sheet: song.has_sheet,
        has_mp3: song.has_mp3,
    };
}

export class MockDB {
    private songs: Song[] = [];
    private sourceList: SongSource[] = [];
    private metaDbData: MetaDbFixture | null = null;
    private _type = 'mock';

    constructor() {
        (this as any)._type = this._type;
    }

    type(): string {
        return this._type;
    }

    full_type(): string {
        return this._type;
    }

    query_validity(): string {
        return this._type;
    }

    get_version_string(): string {
        return 'mock-db';
    }

    ideal_debounce(): number {
        return 250;
    }

    async loadFixtures(languages: string[]): Promise<void> {
        for (const lang of languages) {
            const data = await loadFixture(`db.${lang}.json`);
            for (const raw of (data as FixtureContainer).data) {
                this.songs.push(fixtureSongToSong(raw));
            }
        }
    }

    async loadMetaDb(): Promise<void> {
        this.metaDbData = (await loadFixture('db.smeta.json')) as MetaDbFixture;
    }

    setSongs(songs: Song[]): void {
        this.songs = songs;
    }

    getSongs(): Song[] {
        return this.songs;
    }

    async _initialize_db(): Promise<void> {}
    async _populate_db(): Promise<void> {}

    async _search_meta(): Promise<{ albums: Album[]; sources: SongSource[] }> {
        return { albums: [], sources: this.sourceList };
    }

    async _get_songs(ids: number[]): Promise<SongShortData[]> {
        return ids
            .map((id) => this.songs.find((s) => s.id === id))
            .filter((s): s is Song => !!s)
            .map(songToShortData);
    }

    async get_song(id: number): Promise<Song | null> {
        return this.songs.find((s) => s.id === id) ?? null;
    }

    async get_song_sources(): Promise<SongSource[]> {
        return this.sourceList;
    }

    async search(filters: DBBaseFilters, pager: DBRequestedItems): Promise<DBSearchRunResult> {
        return this._run_search(filters, pager);
    }

    async search_meta(_filters: DBBaseFilters): Promise<(SongSource | Album)[]> {
        const meta = await this._search_meta();
        return [...meta.sources];
    }

    async get_songs(ids: number[]): Promise<SongShortData[]> {
        return this._get_songs(ids);
    }

    async has_any_songs(): Promise<boolean> {
        return this.songs.length > 0;
    }

    _prepare_query(filters: DBBaseFilters): DBFilters {
        return { ...filters, advanced_tags: {} };
    }

    async _run_search(query: DBBaseFilters, pager: DBRequestedItems): Promise<DBSearchRunResult> {
        let results = [...this.songs];
        const search = query.search || '';

        if (search) {
            const lowerSearch = search.toLowerCase();

            if (/^\s*(i\d+[\s,]+)+$/.test(search + ' ')) {
                const ids = search.match(/\d+/g);
                if (ids) {
                    const idSet = new Set(ids.map(Number));
                    results = results.filter((s) => idSet.has(s.id));
                }
            } else {
                const normalized = lowerSearch.replace(/\*/g, '').replace(/\./g, '').replace(/_/g, '');

                results = results.filter((s) => {
                    const searchText = (s.search_title + ' ' + s.alternative_search_titles + ' ' + s.search_text).toLowerCase();
                    if (searchText.includes(search)) return true;
                    if (searchText.includes(normalized)) return true;
                    if (String(s.id) === search.trim()) return true;
                    return false;
                });
            }
        }

        if (query.lang && query.lang !== 'all') {
            results = results.filter((s) => s.lang === query.lang);
        }

        if (query.has_chord !== undefined) {
            const wantChord = query.has_chord === 1;
            results = results.filter((s) => s.has_chord === (wantChord ? 1 : 0));
        }

        if (query.is_original !== undefined) {
            const wantOriginal = query.is_original === 1;
            results = results.filter((s) => s.is_original === (wantOriginal ? 1 : 0));
        }

        if (query.favourite !== undefined) {
            const wantFav = query.favourite === 1;
            results = results.filter((s) => s.favourite === (wantFav ? 1 : 0));
        }

        const total = results.length;
        const start = pager.start || 0;
        const size = pager.size || 50;

        const page = results.slice(start, start + size);
        const shortData = page.map(songToShortData);

        return { data: shortData, total };
    }

    async _get_total(query: DBBaseFilters): Promise<number> {
        const result = await this._run_search(query, { start: 0, size: 1 });
        return result.total ?? 0;
    }

    add_timing_stat(_timeMs: number): void {}
}
