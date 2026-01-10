import * as Comlink from 'comlink';
import { DB } from '../db';
import { get_page_args, refresh_selectmenu } from '../jqm-util';
import { app_lang, get_language_options } from '../langpack';
import { SET_DB } from '../set-db';
import type { Columns, FontSize, PaperSize, SongbookConfig, SongbookData, SongbookViewerApi } from '../songbook-viewer';
import { gup } from '../splash-util.es5';
import { timeout } from '../util';

function getDefaultConfig(): SongbookConfig {
    return {
        paperSize: 'a4',
        fontSize: 11,
        columns: 2,
        twoside: false,
        wantChords: true,
        doubleSpace: false,
        includeFrontPage: true,
        includeCapo: false,
        includeTranslationSource: false,
        includeSources: false,
        includeTranslationSourceIndex: false,
        includeKeyIndex: false,
        includeAlbums: false,
        includeSrefs: false,
        includeAuthors: false,
        includeId: false,
        songbookLanguage: app_lang() || 'en',
    };
}

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
    };
}

function setFormFromConfig(page: JQuery, config: SongbookConfig): void {
    page.find('#songbook-paper-size').val(config.paperSize);
    page.find('#songbook-font-size').val(config.fontSize.toString());
    page.find('#songbook-columns').val(config.columns.toString());
    page.find('#songbook-twoside').prop('checked', config.twoside);
    page.find('#songbook-want-chords').prop('checked', config.wantChords);
    page.find('#songbook-double-space').prop('checked', config.doubleSpace);
    page.find('#songbook-include-front-page').prop('checked', config.includeFrontPage);
    page.find('#songbook-include-capo').prop('checked', config.includeCapo);
    page.find('#songbook-include-translation-source').prop('checked', config.includeTranslationSource);
    page.find('#songbook-include-sources').prop('checked', config.includeSources);
    page.find('#songbook-include-translation-source-index').prop('checked', config.includeTranslationSourceIndex);
    page.find('#songbook-include-key-index').prop('checked', config.includeKeyIndex);
    page.find('#songbook-include-albums').prop('checked', config.includeAlbums);
    page.find('#songbook-include-srefs').prop('checked', config.includeSrefs);
    page.find('#songbook-include-authors').prop('checked', config.includeAuthors);
    page.find('#songbook-include-id').prop('checked', config.includeId);
    page.find('#songbook-language').val(config.songbookLanguage);
}

let viewerWindow: Window | null = null;
let viewerApi: Comlink.Remote<SongbookViewerApi> | null = null;
let baseSongbookData: Partial<SongbookData> = {};

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

    // Add in other songs that the window may need
    const otherSongIds = baseSongbookData.songs.map((song) => song.related_songs.filter((s) => s.type === 'pri').map((s) => s.id)).flat();
    baseSongbookData.otherSongs = (await Promise.all(otherSongIds.map((id) => db.get_song(id)))).filter((s) => !!s);
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
    console.log('Sending data to viewer', viewerApi);
    if (!viewerApi) return;

    const config = getConfigFromForm(page);
    await viewerApi.setSongbookData({
        ...baseSongbookData,
        config,
    } as SongbookData);
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
        const options = await get_language_options();
        languageSelect.empty();
        options.forEach((opt) => languageSelect.append(opt));
        languageSelect.val(app_lang());
        refresh_selectmenu(languageSelect);

        const defaultConfig = getDefaultConfig();
        setFormFromConfig(page, defaultConfig);

        page.find('select, input[type="checkbox"]').on('change', () => {
            updateViewerConfig(page);
        });
        page.find('#button-preview-songbook').on('click', () => {
            openPreviewWindow(page);
        });
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
