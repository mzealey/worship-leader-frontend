import * as Comlink from 'comlink';
import { _lang_setup, get_translation } from './langpack';
import type { SongbookConfig } from './page/page-print-songbook';
import type { Song } from './song';
import './songbook-viewer.scss';
import { format_html_chords, render_chord, songxml_to_divs, split_songxml_chords } from './songxml-util';
import { is_rtl, is_vertical } from './util';

export type SongbookSong = Song;

export interface SongbookData {
    songs: SongbookSong[];
    config: SongbookConfig;
    setName: string;
}

interface IndexEntry {
    id: number;
    title: string;
    songbookPosition: number;
    lang?: string;
}

interface LanguageIndex {
    language: string;
    languageName: string;
    entries: IndexEntry[];
}

interface KeyGroup {
    key: string;
    entries: IndexEntry[];
}

interface TranslationIndexEntry {
    id: number;
    title: string;
    songbookPosition: number;
    sourceTitle: string;
    lang?: string;
}

let songbookEl: HTMLElement | null = null;
let loadingEl: HTMLElement | null = null;
let currentData: SongbookData | null = null;

function setDirection(element: HTMLElement, lang?: string, isBlock = false): void {
    const text = element.textContent || '';
    const rtl = is_rtl(text);
    const vertical = is_vertical(text);

    element.dir = rtl ? 'rtl' : 'ltr';
    if (lang) element.lang = lang;

    if (isBlock && vertical) {
        element.classList.add('vertical-lr');
    }
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getAuthors(song: SongbookSong): string[] {
    if (!song.info) return [];

    const authorTypes = ['words', 'music', 'wordsandmusic'];

    return song.info.filter((info) => authorTypes.includes(info.type)).map((info) => `${get_translation(info.type)}: ${info.value}`);
}

function getSources(song: SongbookSong): string[] {
    if (!song.sources) return [];

    return song.sources.filter((source) => source.number > 0).map((source) => `${source.name} ${source.number}`);
}

function getAlbums(song: SongbookSong): string[] {
    if (!song.albums) return [];

    const albumLabel = get_translation('editor.album');
    return song.albums
        .filter((albumSong) => albumSong.album?.title)
        .map((albumSong) => {
            const title = albumSong.album.title;
            return albumSong.track ? `${albumLabel}: ${title} (${albumSong.track})` : `${albumLabel}: ${title}`;
        });
}

function getScriptureRefs(song: SongbookSong): string[] {
    if (!song.info) return [];

    const srefLabel = get_translation('sref');
    return song.info.filter((info) => info.type === 'sref').map((info) => `${srefLabel}: ${info.value}`);
}

function getTranslationSources(song: SongbookSong): string[] {
    const label = get_translation('editor.translation_of_songbook');
    // TODO: Fetch translation titles if this flag is set - source_song.title
    return [].map((s) => `${label}: ${song.source_title}`);
}

function renderSongMetadata(song: SongbookSong, config: SongbookConfig): HTMLElement | null {
    const metadataItems: string[] = [];

    if (config.includeAuthors) metadataItems.push(...getAuthors(song));
    if (config.includeSources) metadataItems.push(...getSources(song));
    if (config.includeAlbums) metadataItems.push(...getAlbums(song));
    if (config.includeSrefs) metadataItems.push(...getScriptureRefs(song));
    if (config.includeTranslationSource) metadataItems.push(...getTranslationSources(song));
    if (config.includeCapo && song.songkey) metadataItems.push(`${get_translation('songkey')}: ${song.songkey}`);
    if (config.includeCapo && song.capo) metadataItems.push(`${get_translation('capo')}: ${song.capo}`);
    if (config.includeId) metadataItems.push(`${get_translation('editor.id')}: i${song.id}`);

    if (metadataItems.length === 0) return null;

    const metadataDiv = document.createElement('div');
    metadataDiv.className = 'song-metadata';
    metadataDiv.innerHTML = metadataItems.map((item) => `<div class="metadata-item">${escapeHtml(item)}</div>`).join('');
    setDirection(metadataDiv, song.lang);

    return metadataDiv;
}

function renderSongContent(song: SongbookSong, config: SongbookConfig): HTMLElement {
    const songxmlDiv = document.createElement('div');
    const showChords = config.wantChords;
    songxmlDiv.className = `songxml ${showChords ? 'showchords' : ''}`;
    if (config.doubleSpace && showChords) {
        songxmlDiv.classList.add('double-space');
    }
    songxmlDiv.innerHTML = split_songxml_chords(songxml_to_divs(song.songxml, !showChords));
    setDirection(songxmlDiv, song.lang, true);
    return songxmlDiv;
}

function renderSong(song: SongbookSong, index: number, config: SongbookConfig): HTMLElement {
    const div = document.createElement('div');
    div.className = 'song';
    div.id = `song-${song.id}`;
    div.dataset.id = String(song.id);

    const header = document.createElement('div');
    header.className = 'song-header';

    const title = document.createElement('p');
    title.className = 'song-title';
    title.innerHTML = `<span class="song-number">${index + 1}.</span> ${escapeHtml(song.title)}`;
    setDirection(title, song.lang);
    header.appendChild(title);

    for (const alt of song.alternative_titles) {
        const altTitle = document.createElement('p');
        altTitle.className = 'song-alttitle';
        altTitle.innerHTML = escapeHtml(alt);
        setDirection(altTitle, song.lang);
        header.appendChild(altTitle);
    }

    const metadata = renderSongMetadata(song, config);
    if (metadata) {
        header.appendChild(metadata);
    }

    div.appendChild(header);
    div.appendChild(renderSongContent(song, config));

    return div;
}

function markSectionsWithChords(): void {
    document.querySelectorAll('.chord').forEach((chord) => {
        const section = chord.closest('.bridge, .chorus, .verse, .prechorus');
        if (section) section.classList.add('has-chords');
        if (chord.textContent) chord.textContent = render_chord(chord.textContent);
    });
}

function applyConfigStyles(config: SongbookConfig): void {
    const root = document.documentElement;
    root.style.setProperty('--songbook-font-size', `${config.fontSize}pt`);
    root.style.setProperty('--songbook-columns', String(config.columns));

    document.body.classList.remove('paper-a4', 'paper-a5');
    document.body.classList.add(`paper-${config.paperSize}`);

    document.body.classList.toggle('twoside', config.twoside);
}

function renderFrontPage(setName: string, config: SongbookConfig): HTMLElement {
    const page = document.createElement('div');
    page.className = 'page-group front-page';

    // A4 and A5 have different aspect ratios - we simulate the page dimensions
    // A4: 210mm x 297mm, A5: 148mm x 210mm
    if (config.paperSize === 'a5') {
        page.classList.add('paper-a5');
    }

    const titleWrapper = document.createElement('div');
    titleWrapper.className = 'front-page-title-wrapper';

    const title = document.createElement('h1');
    title.className = 'front-page-title';
    title.textContent = setName;
    setDirection(title);

    titleWrapper.appendChild(title);
    page.appendChild(titleWrapper);

    return page;
}

function getIndexSeparator(lang?: string): string {
    const text = lang ? get_translation(`language_names.${lang}`) : '';
    return is_rtl(text) ? '\u060C ' : ', ';
}

function buildMainIndex(songs: SongbookSong[]): LanguageIndex[] {
    const languageGroups = new Map<string, IndexEntry[]>();

    songs.forEach((song, idx) => {
        if (!song.songxml) return;

        const lang = song.lang || 'en';
        if (!languageGroups.has(lang)) languageGroups.set(lang, []);

        [...song.alternative_titles, song.title]
            .filter((title) => !!title)
            .forEach((title) => {
                languageGroups.get(lang)!.push({
                    id: song.id,
                    title: title,
                    songbookPosition: idx + 1,
                    lang,
                });
            });
    });

    const indexes: LanguageIndex[] = [];
    for (const [lang, entries] of languageGroups) {
        entries.sort((a, b) => a.title.localeCompare(b.title, lang));
        indexes.push({
            language: lang,
            languageName: get_translation(`language_names.${lang}`),
            entries,
        });
    }

    indexes.sort((a, b) => a.languageName.localeCompare(b.languageName));
    return indexes;
}

function buildKeyIndex(songs: SongbookSong[]): KeyGroup[] {
    const keyGroups = new Map<string, IndexEntry[]>();

    songs.forEach((song, idx) => {
        if (!song.songxml || !song.songkey) return;
        const key = song.songkey;
        if (!keyGroups.has(key)) keyGroups.set(key, []);

        [...song.alternative_titles, song.title].forEach((title) => {
            keyGroups.get(key)!.push({
                id: song.id,
                title: title,
                songbookPosition: idx + 1,
                lang: song.lang,
            });
        });
    });

    const groups: KeyGroup[] = [];
    for (const [key, entries] of keyGroups) {
        entries.sort((a, b) => a.title.localeCompare(b.title));
        groups.push({ key, entries });
    }

    groups.sort((a, b) => a.key.localeCompare(b.key));
    return groups;
}

function buildTranslationSourceIndex(songs: SongbookSong[]): TranslationIndexEntry[] {
    const entries: TranslationIndexEntry[] = [];

    songs.forEach((song, idx) => {
        if (!song.songxml || !song.source_title) return;
        entries.push({
            id: song.id,
            title: song.title,
            songbookPosition: idx + 1,
            sourceTitle: song.source_title,
            lang: song.lang,
        });
    });

    entries.sort((a, b) => a.title.localeCompare(b.title));
    return entries;
}

function renderIndexEntry(entry: IndexEntry): HTMLElement {
    const item = document.createElement('li');
    item.className = 'index-entry';
    const separator = getIndexSeparator(entry.lang);
    item.innerHTML = `<a href="#song-${entry.id}">${escapeHtml(entry.title)}${separator}${entry.songbookPosition}</a>`;
    setDirection(item, entry.lang);
    return item;
}

function renderMainIndex(songs: SongbookSong[]): HTMLElement {
    const indexes = buildMainIndex(songs);
    const container = document.createElement('div');
    container.className = 'page-group index-section main-index';

    for (const langIndex of indexes) {
        const section = document.createElement('div');
        section.className = 'index-language-section';

        const header = document.createElement('h2');
        header.className = 'index-header';
        const indexLabel = get_translation('index');
        header.textContent = `${langIndex.languageName} ${indexLabel}`;
        setDirection(header, langIndex.language);
        section.appendChild(header);

        const list = document.createElement('ul');
        list.className = 'index-list';
        setDirection(list, langIndex.language);

        for (const entry of langIndex.entries) {
            list.appendChild(renderIndexEntry(entry));
        }

        section.appendChild(list);
        container.appendChild(section);
    }

    return container;
}

function renderKeyIndex(songs: SongbookSong[]): HTMLElement {
    const groups = buildKeyIndex(songs);
    const container = document.createElement('div');
    container.className = 'page-group index-section key-index';

    const mainHeader = document.createElement('h2');
    mainHeader.className = 'index-header';
    mainHeader.textContent = get_translation('editor.key_index');
    container.appendChild(mainHeader);

    for (const group of groups) {
        const section = document.createElement('div');
        section.className = 'index-key-section';

        const keyHeader = document.createElement('h3');
        keyHeader.className = 'index-subheader';
        keyHeader.textContent = group.key;
        section.appendChild(keyHeader);

        const list = document.createElement('ul');
        list.className = 'index-list';

        for (const entry of group.entries) {
            list.appendChild(renderIndexEntry(entry));
        }

        section.appendChild(list);
        container.appendChild(section);
    }

    return container;
}

function renderTranslationSourceIndex(songs: SongbookSong[]): HTMLElement {
    const entries = buildTranslationSourceIndex(songs);
    const container = document.createElement('div');
    container.className = 'page-group index-section translation-source-index';

    const header = document.createElement('h2');
    header.className = 'index-header';
    header.textContent = get_translation('editor.include_trans_index');
    container.appendChild(header);

    const list = document.createElement('ul');
    list.className = 'index-list';

    for (const entry of entries) {
        const item = document.createElement('li');
        item.className = 'index-entry translation-entry';
        const separator = getIndexSeparator(entry.lang);
        const translationLabel = get_translation('editor.translation_of_songbook');
        item.innerHTML = `<a href="#song-${entry.id}">${escapeHtml(entry.title)}${separator}${entry.songbookPosition}</a> <span class="translation-source">(${translationLabel}: ${escapeHtml(entry.sourceTitle)})</span>`;
        setDirection(item, entry.lang);
        list.appendChild(item);
    }

    container.appendChild(list);
    return container;
}

let currentLanguage = '';

async function renderSongbook(data: SongbookData): Promise<void> {
    if (!songbookEl) return;

    if (data.config.songbookLanguage && data.config.songbookLanguage !== currentLanguage) {
        await _lang_setup(data.config.songbookLanguage);
        currentLanguage = data.config.songbookLanguage;
        console.log('Changed language to ', currentLanguage, get_translation('worship-leader'));
        document.body.dir = get_translation('langpack_direction');
        document.body.lang = currentLanguage;
    }

    currentData = data;
    songbookEl.innerHTML = '';

    applyConfigStyles(data.config);

    if (data.config.includeFrontPage && data.setName) {
        songbookEl.appendChild(renderFrontPage(data.setName, data.config));
    }

    songbookEl.appendChild(renderMainIndex(data.songs));

    const songSection = document.createElement('div');
    songSection.className = 'page-group songs';
    songbookEl.appendChild(songSection);

    data.songs.forEach((song, i) => {
        if (song.songxml) {
            songSection.appendChild(renderSong(song, i, data.config));
        }
    });

    if (data.config.includeKeyIndex) {
        songbookEl.appendChild(renderKeyIndex(data.songs));
    }

    if (data.config.includeTranslationSourceIndex) {
        songbookEl.appendChild(renderTranslationSourceIndex(data.songs));
    }

    markSectionsWithChords();

    setTimeout(() => {
        document.querySelectorAll('.songxml.showchords').forEach((el) => {
            format_html_chords(el as HTMLElement);
        });
    }, 50);

    if (loadingEl) {
        loadingEl.style.display = 'none';
    }
}

async function updateConfig(config: SongbookConfig): Promise<void> {
    if (currentData) {
        currentData.config = config;
        await renderSongbook(currentData);
    }
}

export const songbookViewerApi = {
    async setSongbookData(data: SongbookData): Promise<void> {
        await renderSongbook(data);
    },

    async updateConfig(config: SongbookConfig): Promise<void> {
        await updateConfig(config);
    },

    ping(): string {
        return 'pong';
    },
};

export type SongbookViewerApi = typeof songbookViewerApi;

function init(): void {
    songbookEl = document.getElementById('songbook');
    loadingEl = document.getElementById('loading');

    if (window.opener) {
        Comlink.expose(songbookViewerApi, Comlink.windowEndpoint(window.opener));
    }

    (window as unknown as { songbookViewerApi: typeof songbookViewerApi }).songbookViewerApi = songbookViewerApi;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
