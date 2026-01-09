import { Button, ButtonGroup, FormControl, Grid, InputBase, NativeSelect } from '@mui/material';
import { useEffect, useState } from 'react';
import { DelayedDBInput } from '../component/delayed-db-input';
import { TristateCheckbox } from '../component/tristate-checkbox';
import * as DBFns from '../db';
import { useSearchStore } from '../db-search';
import { get_db_chosen_langs } from '../db/common';
import { useAppLang, useTranslation } from '../langpack';
import { get_meta_db, type MetaDb } from '../meta-db';
import { PageSourceSelect } from '../page/source-select';
import { PageTagSelect } from '../page/tag_select';
import * as Icon from './icons';
import { Theme } from './theme';

type SourceInfo = {
    id: number;
    name: string;
};

const SearchSelect = (props: React.ComponentProps<typeof NativeSelect>) => <NativeSelect input={<InputBase />} {...props} />;

// Define the props that can be passed to SearchFilters from outside
export interface SearchFiltersProps {
    onClose?: () => void;
    thin?: boolean;
}

function SongKeyInput(props: React.ComponentProps<typeof DelayedDBInput>) {
    const { t } = useTranslation();
    const { ...restProps } = props;

    return <DelayedDBInput {...restProps} placeholder={t('key_text')} title={t('key_text')} />;
}

export function SearchFilters(props: SearchFiltersProps) {
    const { thin } = props;
    const { t, sorted_language_codes, lang_name } = useTranslation();
    const { appLang } = useAppLang();

    const sources = useSearchStore((state) => state.sources);
    const tags = useSearchStore((state) => state.tags);
    const filters = useSearchStore((state) => state.filters);

    const [db_type, setDbType] = useState<string | undefined>(undefined);
    const [source_list, setSourceList] = useState<SourceInfo[] | undefined>(undefined);
    const [meta_db, setMetaDb] = useState<MetaDb | undefined>(undefined);
    const [show_tag_selector, setShowTagSelector] = useState(false);
    const [show_source_selector, setShowSourceSelector] = useState(false);

    const refresh_langs = async (): Promise<void> => {
        const db = await DBFns.DB;
        setDbType(db.type());
    };

    useEffect(() => {
        refresh_langs();
        const listener = DBFns.on_db_languages_update.subscribe(() => refresh_langs());
        DBFns.DB.then((db) => db.get_song_sources()).then((list) => setSourceList(list as SourceInfo[]));
        get_meta_db().then((meta: MetaDb) => setMetaDb(meta));

        return () => listener.unsubscribe();
    }, []);

    const resetSources = () => useSearchStore.getState().resetSourceFilter();
    const resetTags = () => useSearchStore.getState().resetTagFilter();
    const updateFilter = useSearchStore.getState().setFilters;

    const sorted_langs = sorted_language_codes(get_db_chosen_langs([]));

    const breakpoint: { xs: number; md?: number; sm?: number } = { xs: 12 };
    if (!thin) {
        breakpoint.md = 4;
        breakpoint.sm = 6;
    }
    let sources_text, tags_text;
    if (source_list && Object.keys(sources).length > 0) {
        const sourceIds = new Set(Object.keys(sources).map((id) => Number(id)));
        sources_text = source_list
            .filter((source) => sourceIds.has(source.id))
            .map((source) => source.name)
            .join(', ');
    }

    if (meta_db && appLang) {
        const tagIds = Object.keys(tags);
        if (tagIds.length > 0) {
            const { tag_mappings, tags: metaTags } = meta_db;
            tags_text = tagIds
                .map((tag_id) => tag_mappings[tag_id]?.tag_code)
                .filter((tag_code): tag_code is string => !!tag_code)
                .map((tag_code) => metaTags[tag_code]?.[appLang] ?? '')
                .filter((name): name is string => !!name)
                .join(', ');
        }
    }

    return (
        <Grid container spacing={1} style={{ marginTop: 4 }}>
            <Grid>
                <FormControl fullWidth>
                    <SearchSelect
                        title={t('sort_default')}
                        value={filters.order_by}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                            updateFilter({ order_by: e.target.value });
                        }}
                    >
                        <option value="default">{t('sort_default')}</option>
                        <option value="real_song_usage desc">{t('sort_popular')}</option>
                        <option value="sort_title asc">{t('sort_title')}</option>
                        <option value="sort_title desc">{t('sort_title_back')}</option>
                        <option value="rating desc">{t('sort_rated')}</option>
                        <option value="songs.id desc">{t('sort_added')}</option>
                        <option value="song_ts desc">{t('sort_updated')}</option>
                        <option value="song_source.number asc">{t('sort_song_number')}</option>
                        <option value="year desc">{t('year_written')}</option>
                        {db_type == 'offline' && <option value="usage_stat.last_view desc">{t('sort_last_viewed')}</option>}
                        {db_type == 'offline' && <option value="usage_stat.total_views desc">{t('sort_most_viewed')}</option>}
                    </SearchSelect>
                </FormControl>
            </Grid>
            <Grid>
                <FormControl fullWidth>
                    <SearchSelect
                        title={t('button-choose-song-languages')}
                        value={filters.lang}
                        sx={filters.lang != 'all' ? { backgroundColor: 'blue' } : {}}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                            updateFilter({ lang: e.target.value });
                        }}
                    >
                        <option value="all">{t('filter_lang_all')}</option>
                        {sorted_langs.map((code) => (
                            <option key={code} value={code}>
                                {lang_name(code)}
                            </option>
                        ))}
                    </SearchSelect>
                </FormControl>
            </Grid>
            <Grid>
                <ButtonGroup>
                    <Button style={{ flexGrow: 1 }} onClick={() => setShowTagSelector(true)}>
                        {t('tag_str')}
                        {tags_text && `: ${tags_text}`}
                    </Button>
                    {Object.keys(tags).length > 0 && (
                        <Button onClick={() => resetTags()}>
                            <Icon.Clear />
                        </Button>
                    )}
                </ButtonGroup>
                {show_tag_selector && (
                    <Theme section="Base">
                        <PageTagSelect onClose={() => setShowTagSelector(false)} />
                    </Theme>
                )}
            </Grid>
            <Grid>
                <ButtonGroup>
                    <Button style={{ flexGrow: 1 }} onClick={() => setShowSourceSelector(true)}>
                        {t('source_str')}
                        {sources_text && `: ${sources_text}`}
                    </Button>
                    {Object.keys(sources).length > 0 && (
                        <Button onClick={() => resetSources()}>
                            <Icon.Clear />
                        </Button>
                    )}
                </ButtonGroup>
                {show_source_selector && (
                    <Theme section="Base">
                        <PageSourceSelect onClose={() => setShowSourceSelector(false)} />
                    </Theme>
                )}
            </Grid>
            <Grid>
                <SongKeyInput fullWidth onChange={(v: string) => updateFilter({ songkey: v == '' ? undefined : v })} />
            </Grid>
            <Grid>
                <TristateCheckbox onChange={(state?: 1 | 0) => updateFilter({ has_mp3: state })}>
                    {t('listen_words')} <Icon.SymbolHasMP3 />
                </TristateCheckbox>
            </Grid>
            <Grid>
                <TristateCheckbox onChange={(state?: 1 | 0) => updateFilter({ has_chord: state })}>
                    {t('edit_chords')} <Icon.SymbolHasChord />
                </TristateCheckbox>
            </Grid>
            <Grid>
                <TristateCheckbox onChange={(state?: 1 | 0) => updateFilter({ has_sheet: state })}>
                    {t('has_sheet')} <Icon.SymbolHasSheet />
                </TristateCheckbox>
            </Grid>
            <Grid>
                <TristateCheckbox onChange={(state?: 1 | 0) => updateFilter({ is_original: state })}>
                    {t('untranslated_song')} <Icon.SymbolOriginal />
                </TristateCheckbox>
            </Grid>
            <Grid>
                <TristateCheckbox onChange={(state?: 0 | 1) => updateFilter({ favourite: state })}>
                    {t('favourite-filter')} <Icon.SymbolFavourite />
                </TristateCheckbox>
            </Grid>
        </Grid>
    );
}
