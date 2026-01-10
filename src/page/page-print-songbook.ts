import * as Comlink from 'comlink';
import LANGPACK_INDEX from '../../langpack/index.json';
import { DB } from '../db';
import { get_db_chosen_langs } from '../db/common';
import { get_page_args, refresh_selectmenu } from '../jqm-util';
import { app_lang, lang_name, langpack_loaded, sorted_language_codes } from '../langpack';
import { SET_DB } from '../set-db';
import type { Song, SongShortData } from '../song';
import type { Columns, FontSize, PaperSize, SongbookConfig, SongbookData, SongbookViewerApi } from '../songbook-viewer';
import { gup } from '../splash-util.es5';
import { timeout } from '../util';

function getConfigFromForm(page: JQuery): SongbookConfig {
    return {
        paperSize: page.find('#songbook-paper-size').val() as PaperSize,
        fontSize: parseInt(page.find('#songbook-font-size').val() as string, 10) as FontSize,
        columns: parseInt(page.find('#songbook-columns').val() as string, 10) as Columns,
        twoside: page.find('#songbook-twoside').is(':checked'),
        wantChords: page.find('#songbook-want-chords').is(':checked'),
        doubleSpace: page.find('#songbook-double-space').is(':checked'),
        includeFrontPage: page.find('#songbook-include-front-page').is(':checked'),
        includeCapo: page.find('#songbook-include-capo').is(':checked'),
        includeTranslationSource: page.find('#songbook-include-translation-source').is(':checked'),
        includeSources: page.find('#songbook-include-sources').is(':checked'),
        includeTranslationSourceIndex: page.find('#songbook-include-translation-source-index').is(':checked'),
        includeKeyIndex: page.find('#songbook-include-key-index').is(':checked'),
        includeAlbums: page.find('#songbook-include-albums').is(':checked'),
        includeSrefs: page.find('#songbook-include-srefs').is(':checked'),
        includeAuthors: page.find('#songbook-include-authors').is(':checked'),
        includeId: page.find('#songbook-include-id').is(':checked'),
        songbookLanguage: (page.find('#songbook-language').val() as string) || app_lang() || 'en',
        songbookSideBySide: page.find('#songbook-sidebyside').val() as string,
    };
}

let viewerWindow: Window | null = null;
let viewerApi: Comlink.Remote<SongbookViewerApi> | null = null;
let baseSongbookData: Partial<SongbookData> = {
    translationMap: {},
};

function closeViewerWindow(): void {
    if (viewerWindow && !viewerWindow.closed) {
        viewerWindow.close();
    }
    viewerWindow = null;
    viewerApi = null;
    $('#button-preview-songbook').show();
}

window.addEventListener('beforeunload', closeViewerWindow);

async function updateSongbookData(setId: number): Promise<void> {
    const setSongs = SET_DB.get_songs(setId);
    if (!setSongs.length) {
        baseSongbookData = {};
        return;
    }

    baseSongbookData.setName = await SET_DB.get_set_title(setId);

    const songIds = setSongs.map((s) => s.song_id);
    const db = await DB;
    // To get the full detail we have to fetch the songs individually at present. TODO: Add an extended get_songs
    // method in online db also
    baseSongbookData.songs = (await Promise.all(songIds.map((id) => db.get_song(id)))).filter((s) => !!s);

    // Add in other songs (for translation titles etc) that the window may need
    const otherSongIds = baseSongbookData.songs.map((song) => song.related_songs.filter((s) => s.type === 'pri').map((s) => s.id)).flat();
    baseSongbookData.otherSongs = await db.get_songs(otherSongIds);
}

async function updateTranslationSongs(config: SongbookConfig): Promise<void> {
    const db = await DB;
    if (!baseSongbookData.songs || !config.songbookSideBySide) return;

    // No easy way - first do a get_songs for all related songs so we can find out what language they are in, then
    // choose the first one that matches
    const translationSongIds = baseSongbookData.songs.map((song) => song.related_songs.map((s) => s.id)).flat();
    const translationSongShorts = (await db.get_songs(translationSongIds)).filter((s) => s.lang === config.songbookSideBySide);
    const translationMap: Record<number, SongShortData> = {};
    for (const tsong of translationSongShorts) translationMap[tsong.id] = tsong;

    // Now load the full ones for each match
    const newMap: Record<number, Song> = {};
    await Promise.all(
        baseSongbookData.songs.map(async (song) => {
            // Get the first match for the given song - may be multiple but we assume that the first is the best. TODO:
            // Could check pri first?
            const tsong = song.related_songs.map((s) => translationMap[s.id]).filter((s) => !!s)[0];
            if (!tsong) return;

            if (song.lang == tsong.lang) return;
            const full_song = await db.get_song(tsong.id);
            if (full_song && full_song.songxml) newMap[song.id] = full_song;
        }),
    );
    baseSongbookData.translationMap = newMap;
}

async function connectToViewer(win: Window): Promise<Comlink.Remote<SongbookViewerApi>> {
    const api = Comlink.wrap<SongbookViewerApi>(Comlink.windowEndpoint(win));
    await timeout(api.ping(), 5000);
    return api;
}

async function openPreviewWindow(page: JQuery): Promise<void> {
    if (!viewerWindow || viewerWindow.closed) {
        viewerWindow = window.open('songbook-viewer.html', 'songbook-viewer', 'width=800,height=600,scrollbars=yes,resizable=yes');
        if (!viewerWindow) {
            console.error('Failed to open popup window');
            $('#button-preview-songbook').show();
            return;
        }

        viewerWindow.addEventListener('load', async () => {
            viewerWindow!.addEventListener('unload', () => closeViewerWindow());

            try {
                viewerApi = await connectToViewer(viewerWindow!);
                $('#button-preview-songbook').hide();
                await sendDataToViewer(page);
            } catch (e) {
                console.error('Failed to connect to viewer:', e);
            }
        });
        // TODO: Handle close and set the viewerApi to null and show visibility of the button
    } else {
        await sendDataToViewer(page);
        viewerWindow.focus();
    }
}

async function sendDataToViewer(page: JQuery): Promise<void> {
    if (!viewerApi) return;

    const config = getConfigFromForm(page);
    const data = {
        ...baseSongbookData,
        config,
    } as SongbookData;
    console.log('Sending data to viewer', data);
    await viewerApi.setSongbookData(data);
}

async function updateViewerConfig(page: JQuery): Promise<void> {
    if (!viewerApi || !viewerWindow || viewerWindow.closed) return;

    const config = getConfigFromForm(page);
    await viewerApi.updateConfig(config);
}

export function init_page_print_songbook(): void {
    const page = $('#page-print-songbook');

    page.on('pageinit', async () => {
        const languageSelect = page.find('#songbook-language');

        await langpack_loaded();
        languageSelect.empty();
        sorted_language_codes(Object.keys(LANGPACK_INDEX)).map((key) => languageSelect.append($('<option>').attr({ value: key }).text(lang_name(key))));
        languageSelect.val(app_lang());
        refresh_selectmenu(languageSelect);

        page.find('select, input[type="checkbox"]').on('change', () => {
            updateViewerConfig(page);
        });
        page.find('#button-preview-songbook').on('click', () => {
            openPreviewWindow(page);
        });

        const lang_filter = page.find('#songbook-sidebyside');
        lang_filter.on('change', async () => {
            console.log('change', lang_filter.val());
            // Changing the language requires re-loading a set of songs from the database for rendering
            await updateTranslationSongs(getConfigFromForm(page));
            await sendDataToViewer(page);
        });
    });

    page.on('pagebeforeshow', async () => {
        const lang_filter = page.find('#songbook-sidebyside');

        const loaded_langs = get_db_chosen_langs([]);

        lang_filter.find('option.auto').remove();

        sorted_language_codes(loaded_langs).forEach((lang_code) => {
            lang_filter.append($('<option class="auto" />').attr({ value: lang_code }).text(lang_name(lang_code)));
        });
        refresh_selectmenu(lang_filter);
    });

    page.on('pageshow', async () => {
        const setId = parseInt(get_page_args(page).set_id || gup('set_id'), 10);
        if (!setId) {
            console.error('No set_id found');
            return;
        }
        await updateSongbookData(setId);
        openPreviewWindow(page);
    });
}
