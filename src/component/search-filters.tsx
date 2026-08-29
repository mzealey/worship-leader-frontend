import { Button, ButtonGroup, FormControl, Grid, InputBase, NativeSelect } from '@mui/material';
import type { ReactNode } from 'react';
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

const FilterGridItem = ({ children, thin }: { children: ReactNode; thin?: boolean }) => (
    <Grid size={thin ? { xs: 12 } : { xs: 12, sm: 6, md: 4 }}>{children}</Grid>
);

const FilterSelect = (props: React.ComponentProps<typeof NativeSelect>) => (
    <FormControl fullWidth>
        <NativeSelect input={<InputBase />} inputProps={{ style: { textAlign: 'center' } }} {...props} />
    </FormControl>
);

const TagsButtonGroup = ({
    text,
    hasSelection,
    onOpen,
    onClear,
    dialog,
}: {
    text: ReactNode;
    hasSelection: boolean;
    onOpen: () => void;
    onClear: () => void;
    dialog: ReactNode;
}) => (
    <>
        <ButtonGroup variant="text">
            <Button sx={(theme) => ({ color: theme.palette.text.link, flexGrow: 1 })} onClick={onOpen}>
                {text}
            </Button>
            {hasSelection ? (
                <Button sx={(theme) => ({ color: theme.palette.text.link })} onClick={onClear}>
                    <Icon.Clear />
                </Button>
            ) : null}
        </ButtonGroup>
        {dialog}
    </>
);

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
            <FilterGridItem thin={thin}>
                <FilterSelect
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
                </FilterSelect>
            </FilterGridItem>
            <FilterGridItem thin={thin}>
                <FilterSelect
                    title={t('button-choose-song-languages')}
                    value={filters.lang || 'all'}
                    sx={filters.lang && filters.lang != 'all' ? { backgroundColor: 'blue' } : {}}
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
                </FilterSelect>
            </FilterGridItem>
            <FilterGridItem thin={thin}>
                <TagsButtonGroup
                    text={
                        <>
                            {t('tag_str')}
                            {tags_text ? `: ${tags_text}` : null}
                        </>
                    }
                    hasSelection={Object.keys(tags).length > 0}
                    onOpen={() => setShowTagSelector(true)}
                    onClear={() => resetTags()}
                    dialog={
                        show_tag_selector ? (
                            <Theme section="Base">
                                <PageTagSelect onClose={() => setShowTagSelector(false)} />
                            </Theme>
                        ) : null
                    }
                />
            </FilterGridItem>
            <FilterGridItem thin={thin}>
                <TagsButtonGroup
                    text={
                        <>
                            {t('source_str')}
                            {sources_text ? `: ${sources_text}` : null}
                        </>
                    }
                    hasSelection={Object.keys(sources).length > 0}
                    onOpen={() => setShowSourceSelector(true)}
                    onClear={() => resetSources()}
                    dialog={
                        show_source_selector ? (
                            <Theme section="Base">
                                <PageSourceSelect onClose={() => setShowSourceSelector(false)} />
                            </Theme>
                        ) : null
                    }
                />
            </FilterGridItem>
            <FilterGridItem thin={thin}>
                <SongKeyInput fullWidth onChange={(v: string) => updateFilter({ songkey: v == '' ? undefined : v })} />
            </FilterGridItem>
            <FilterGridItem thin={thin}>
                <TristateCheckbox state={filters.has_mp3} onChange={(state?: 1 | 0) => updateFilter({ has_mp3: state })}>
                    {t('listen_words')} <Icon.SymbolHasMP3 />
                </TristateCheckbox>
            </FilterGridItem>
            <FilterGridItem thin={thin}>
                <TristateCheckbox state={filters.has_chord} onChange={(state?: 1 | 0) => updateFilter({ has_chord: state })}>
                    {t('edit_chords')} <Icon.SymbolHasChord />
                </TristateCheckbox>
            </FilterGridItem>
            <FilterGridItem thin={thin}>
                <TristateCheckbox state={filters.has_sheet} onChange={(state?: 1 | 0) => updateFilter({ has_sheet: state })}>
                    {t('has_sheet')} <Icon.SymbolHasSheet />
                </TristateCheckbox>
            </FilterGridItem>
            <FilterGridItem thin={thin}>
                <TristateCheckbox state={filters.is_original} onChange={(state?: 1 | 0) => updateFilter({ is_original: state })}>
                    {t('untranslated_song')} <Icon.SymbolOriginal />
                </TristateCheckbox>
            </FilterGridItem>
            {db_type == 'offline' && (
                <FilterGridItem thin={thin}>
                    <TristateCheckbox state={filters.favourite} onChange={(state?: 0 | 1) => updateFilter({ favourite: state })}>
                        {t('favourite-filter')} <Icon.SymbolFavourite />
                    </TristateCheckbox>
                </FilterGridItem>
            )}
        </Grid>
    );
}
