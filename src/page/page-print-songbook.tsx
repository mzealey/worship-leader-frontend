import { Box, CircularProgress, Grid, NativeSelect, useTheme } from '@mui/material';
import * as Comlink from 'comlink';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import LANGPACK_INDEX from '../../langpack/index.json';
import { ImageButton } from '../component/basic';
import * as Icon from '../component/icons';
import { Link } from '../component/router-link';
import { TopBar } from '../component/top-bar';
import { DB } from '../db';
import type { CommonDB } from '../db/common';
import { get_db_chosen_langs } from '../db/common';
import { useAppLang, useTranslation } from '../langpack';
import { on_set_db_update, SET_DB } from '../set-db';
import type { Song, SongShortData } from '../song';
import type { Columns, FontSize, PaperSize, SongbookConfig, SongbookViewerApi } from '../songbook-viewer';
import { timeout } from '../util';

const defaultConfig = (appLang: string): SongbookConfig => ({
    paperSize: 'a4',
    fontSize: 10,
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
    songbookLanguage: appLang || 'en',
    songbookSideBySide: '',
});

interface BaseSongbookData {
    songs: Song[];
    setName: string;
    otherSongs: SongShortData[];
}

async function loadBaseSongbookData(setId: number, db: CommonDB<unknown>): Promise<BaseSongbookData | null> {
    const setSongs = SET_DB.get_songs(setId);
    if (!setSongs.length) return null;

    const setName = await SET_DB.get_set_title(setId);
    const songIds = setSongs.map((s) => s.song_id);
    // Fetch the full song detail individually; the short get_songs() doesn't carry the songxml/etc data
    const songs = (await Promise.all(songIds.map((id) => db.get_song(id)))).filter((s): s is Song => !!s);

    // Related songs flagged as "pri" (original-source) need a short fetch so the viewer can render original-titles etc
    const otherSongIds = songs.flatMap((song) => song.related_songs.filter((s) => s.type === 'pri').map((s) => s.id));
    const otherSongs = (await db.get_songs(otherSongIds, false)).filter((s): s is SongShortData => !('not_loaded' in s));

    return { songs, setName, otherSongs };
}

async function computeTranslationMap(base: BaseSongbookData, targetLang: string, db: CommonDB<unknown>): Promise<Record<number, Song>> {
    if (!targetLang) return {};

    // Need to fetch all related songs so we can pick the first one matching the target language
    const translationSongIds = base.songs.flatMap((song) => song.related_songs.map((s) => s.id));
    const translationShorts = (await db.get_songs(translationSongIds, false)).filter((s): s is SongShortData => !('not_loaded' in s) && s.lang === targetLang);
    const shortMap: Record<number, SongShortData> = {};
    for (const tsong of translationShorts) shortMap[tsong.id] = tsong;

    // Now load the full song xml for each matched translation
    const newMap: Record<number, Song> = {};
    await Promise.all(
        base.songs.map(async (song) => {
            // First match wins - might be multiple but assume the first is the best.
            const tsong = song.related_songs.map((s) => shortMap[s.id]).filter((s): s is SongShortData => !!s)[0];
            if (!tsong) return;
            if (song.lang == tsong.lang) return;

            const full = await db.get_song(tsong.id);
            if (full && full.songxml) newMap[song.id] = full;
        }),
    );
    return newMap;
}

export interface PagePrintSongbookProps {
    set_id: number;
}

export const PagePrintSongbook = ({ set_id }: PagePrintSongbookProps) => {
    const theme = useTheme();
    const { t, lang_name, sorted_language_codes } = useTranslation();
    const { appLang } = useAppLang();
    const navigate = useNavigate();

    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const viewerApiRef = useRef<Comlink.Remote<SongbookViewerApi> | null>(null);

    const [baseData, setBaseData] = useState<BaseSongbookData | null>(null);
    const [translationMap, setTranslationMap] = useState<Record<number, Song>>({});
    const [iframeReady, setIframeReady] = useState(false);
    const [config, setConfig] = useState<SongbookConfig>(() => defaultConfig(appLang || 'en'));

    const baseDataRef = useRef(baseData);
    const translationMapRef = useRef(translationMap);
    const configRef = useRef(config);
    useEffect(() => {
        baseDataRef.current = baseData;
    }, [baseData]);
    useEffect(() => {
        translationMapRef.current = translationMap;
    }, [translationMap]);
    useEffect(() => {
        configRef.current = config;
    }, [config]);

    const sideBySideLanguages = useMemo(() => sorted_language_codes(get_db_chosen_langs([])), [sorted_language_codes]);
    const songbookLanguages = useMemo(() => sorted_language_codes(Object.keys(LANGPACK_INDEX)), [sorted_language_codes]);

    // Load songs for the set whenever the set db updates (or set_id changes)
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const db = await DB;
            const base = await loadBaseSongbookData(set_id, db);
            if (!cancelled) setBaseData(base);
        };
        load();
        const sub = on_set_db_update.subscribe(load);
        return () => {
            cancelled = true;
            sub.unsubscribe();
        };
    }, [set_id]);

    // Connect to the viewer iframe once it has loaded
    useEffect(() => {
        if (!iframeReady) return;
        let cancelled = false;

        (async () => {
            // Tiny delay to ensure the script inside the iframe has registered its Comlink endpoint
            await new Promise((r) => setTimeout(r, 100));

            try {
                const iframe = iframeRef.current!;
                const api = Comlink.wrap<SongbookViewerApi>(Comlink.windowEndpoint(iframe.contentWindow!));
                await timeout(api.ping(), 5000);
                if (cancelled) return;
                viewerApiRef.current = api;

                const data = baseDataRef.current;
                if (data) {
                    await api.setSongbookData({ ...data, translationMap: translationMapRef.current, config: configRef.current });
                }
            } catch (e) {
                console.error('Failed to connect to songbook viewer:', e);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [iframeReady]);

    // Push full data to viewer whenever the underlying song data or translation map changes
    useEffect(() => {
        if (!viewerApiRef.current || !baseData) return;
        viewerApiRef.current.setSongbookData({ ...baseData, translationMap, config });
    }, [baseData, translationMap, config]);

    // Push the new config to the viewer whenever any form field changes
    useEffect(() => {
        if (!viewerApiRef.current) return;
        viewerApiRef.current.updateConfig(config);
    }, [config]);

    // When the side-by-side language changes, reload translation songs for the new language
    useEffect(() => {
        if (!baseData) return;
        let cancelled = false;
        (async () => {
            const db = await DB;
            const newMap = await computeTranslationMap(baseData, config.songbookSideBySide, db);
            if (!cancelled) setTranslationMap(newMap);
        })();
        return () => {
            cancelled = true;
        };
    }, [config.songbookSideBySide, baseData]);

    const updateConfig = useCallback((changes: Partial<SongbookConfig>) => {
        setConfig((prev) => ({ ...prev, ...changes }));
    }, []);

    return (
        <Box sx={{ maxWidth: '100vw', width: '100%', px: 1 }}>
            <TopBar
                before={
                    <ImageButton component={Link} to={`/set-view/${set_id}`} icon={Icon.Back}>
                        {t('back')}
                    </ImageButton>
                }
                title={t('print-songbook')}
            >
                <ImageButton icon={Icon.Share} onClick={() => navigate(`/set-view/${set_id}`)}>
                    {t('set_title')}
                </ImageButton>
            </TopBar>

            <Grid container spacing={2} sx={{ flexDirection: { xs: 'column', md: 'row' } }}>
                <Grid size={{ xs: 12, md: 5 }}>
                    <Grid container spacing={2} sx={{ flexDirection: 'column' }}>
                        <Grid>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: 1 }}>
                                <label htmlFor="songbook-paper-size">{t('editor.paper_size')}</label>
                                <NativeSelect
                                    id="songbook-paper-size"
                                    value={config.paperSize}
                                    onChange={(e) => updateConfig({ paperSize: e.target.value as PaperSize })}
                                    sx={{ minWidth: 180 }}
                                >
                                    <option value="a4">A4</option>
                                    <option value="a5">A5</option>
                                </NativeSelect>
                            </Box>
                        </Grid>

                        <Grid>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: 1 }}>
                                <label htmlFor="songbook-font-size">{t('editor.font_size')}</label>
                                <NativeSelect
                                    id="songbook-font-size"
                                    value={config.fontSize}
                                    onChange={(e) => updateConfig({ fontSize: parseInt(e.target.value, 10) as FontSize })}
                                    sx={{ minWidth: 180 }}
                                >
                                    <option value="10">{t('zoom-small')}</option>
                                    <option value="11">{t('zoom-medium')}</option>
                                    <option value="12">{t('zoom-large')}</option>
                                </NativeSelect>
                            </Box>
                        </Grid>

                        <Grid>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: 1 }}>
                                <label htmlFor="songbook-columns">{t('editor.columns')}</label>
                                <NativeSelect
                                    id="songbook-columns"
                                    value={config.columns}
                                    onChange={(e) => updateConfig({ columns: parseInt(e.target.value, 10) as Columns })}
                                    sx={{ minWidth: 180 }}
                                >
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                    <option value="4">4</option>
                                </NativeSelect>
                            </Box>
                        </Grid>

                        <Grid>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: 1 }}>
                                <label htmlFor="songbook-language">{t('editor.songbook_language')}</label>
                                <NativeSelect
                                    id="songbook-language"
                                    value={config.songbookLanguage}
                                    onChange={(e) => updateConfig({ songbookLanguage: e.target.value })}
                                    sx={{ minWidth: 180 }}
                                >
                                    {songbookLanguages.map((lang) => (
                                        <option key={lang} value={lang}>
                                            {lang_name(lang)}
                                        </option>
                                    ))}
                                </NativeSelect>
                            </Box>
                        </Grid>

                        <Grid>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: 1 }}>
                                <label htmlFor="songbook-sidebyside">{t('editor.songbook_include_translations')}</label>
                                <NativeSelect
                                    id="songbook-sidebyside"
                                    value={config.songbookSideBySide}
                                    onChange={(e) => updateConfig({ songbookSideBySide: e.target.value })}
                                    sx={{ minWidth: 180 }}
                                >
                                    <option value="">{t('none')}</option>
                                    {sideBySideLanguages.map((lang) => (
                                        <option key={lang} value={lang}>
                                            {lang_name(lang)}
                                        </option>
                                    ))}
                                </NativeSelect>
                            </Box>
                        </Grid>

                        <Grid>
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                <BoolSetting label={t('editor.include_chords')} checked={config.wantChords} onChange={(v) => updateConfig({ wantChords: v })} />
                                <BoolSetting
                                    label={t('editor.include_front_page')}
                                    checked={config.includeFrontPage}
                                    onChange={(v) => updateConfig({ includeFrontPage: v })}
                                />
                                <BoolSetting label={t('editor.include_capo')} checked={config.includeCapo} onChange={(v) => updateConfig({ includeCapo: v })} />
                                <BoolSetting
                                    label={t('editor.include_tran_title')}
                                    checked={config.includeTranslationSource}
                                    onChange={(v) => updateConfig({ includeTranslationSource: v })}
                                />
                                <BoolSetting
                                    label={t('editor.include_source_numbers')}
                                    checked={config.includeSources}
                                    onChange={(v) => updateConfig({ includeSources: v })}
                                />
                                <BoolSetting
                                    label={t('editor.include_trans_index')}
                                    checked={config.includeTranslationSourceIndex}
                                    onChange={(v) => updateConfig({ includeTranslationSourceIndex: v })}
                                />
                                <BoolSetting
                                    label={t('editor.include_key_index')}
                                    checked={config.includeKeyIndex}
                                    onChange={(v) => updateConfig({ includeKeyIndex: v })}
                                />
                                <BoolSetting
                                    label={t('editor.include_albums')}
                                    checked={config.includeAlbums}
                                    onChange={(v) => updateConfig({ includeAlbums: v })}
                                />
                                <BoolSetting
                                    label={t('editor.include_sref')}
                                    checked={config.includeSrefs}
                                    onChange={(v) => updateConfig({ includeSrefs: v })}
                                />
                                <BoolSetting
                                    label={t('editor.include_author')}
                                    checked={config.includeAuthors}
                                    onChange={(v) => updateConfig({ includeAuthors: v })}
                                />
                                <BoolSetting label={t('editor.include_id')} checked={config.includeId} onChange={(v) => updateConfig({ includeId: v })} />
                            </Box>
                        </Grid>
                    </Grid>
                </Grid>

                <Grid size={{ xs: 12, md: 7 }}>
                    <Box
                        sx={{
                            position: 'relative',
                            height: { xs: 'auto', md: 'calc(100dvh - 130px)' },
                        }}
                    >
                        <iframe
                            ref={iframeRef}
                            id="songbook-viewer-iframe"
                            src="songbook-viewer.html"
                            title={t('print-songbook')}
                            style={{
                                width: '100%',
                                height: '100%',
                                minHeight: '70vh',
                                border: `1px solid ${theme.palette.border.main}`,
                            }}
                            onLoad={() => setIframeReady(true)}
                        />
                        {!baseData && (
                            <Box
                                sx={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                }}
                            >
                                <CircularProgress />
                            </Box>
                        )}
                    </Box>
                </Grid>
            </Grid>
        </Box>
    );
};

// Simple boolean toggle for the include-* checkboxes
const BoolSetting = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <label>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
);
