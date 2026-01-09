import { Button, Dialog, DialogActions, DialogContent, List, ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { useEffect, useState } from 'react';
import { DialogTitleWithClose, DropDownIcon, ListCheckbox } from '../component/basic';
import { DB, on_db_languages_update } from '../db';
import { useSearchStore } from '../db-search';
import { toggle_filter_source } from '../filter-sources';
import { useTranslation } from '../langpack';
import { useDialog } from '../preact-helpers';
import type { SongSource } from '../song';
import { LOCALE_SORT, SORT_TITLE_SORT } from '../sort-helpers';

interface SourceFilterSectionProps {
    lang: string;
    sources: SongSource[];
}

const SourceFilterSection = ({ lang, sources }: SourceFilterSectionProps) => {
    const [showing, setShowing] = useState(false);
    const filter_sources = useSearchStore((state) => state.sources);
    const { lang_name } = useTranslation();

    return (
        <List dense disablePadding>
            <ListItem disablePadding>
                <ListItemButton onClick={() => setShowing(!showing)}>
                    <ListItemText primary={<b>{lang_name(lang)}</b>} />
                    <DropDownIcon collapsed={!showing} />
                </ListItemButton>
            </ListItem>
            {sources
                .filter((source) => showing || source.id in filter_sources)
                .map((source) => (
                    <ListItem key={source.id} disablePadding>
                        <ListItemButton onClick={() => toggle_filter_source(source.id, undefined)}>
                            <ListItemIcon>
                                <ListCheckbox checked={!!filter_sources[source.id]} />
                            </ListItemIcon>
                            <ListItemText primary={source.name} />
                        </ListItemButton>
                    </ListItem>
                ))}
        </List>
    );
};

// External props (what consumers pass)
export interface PageSourceSelectProps {
    onClose?: () => void;
}

export const PageSourceSelect = ({ onClose }: PageSourceSelectProps) => {
    const { t, sorted_language_codes } = useTranslation();
    const { closed, handleClose } = useDialog(onClose);
    const [sourceLangs, setSourceLangs] = useState<Record<string, SongSource[]>>({});

    const refresh = () => {
        DB.then((db) => db.get_song_sources()).then((sources) => {
            const sourceLangMap: Record<string, SongSource[]> = {};
            sources.forEach((source) => {
                if (!sourceLangMap[source.lang]) sourceLangMap[source.lang] = [];
                sourceLangMap[source.lang].push(source);
            });

            Object.values(sourceLangMap).forEach((langSources) => langSources.sort((a, b) => SORT_TITLE_SORT(a, b) || LOCALE_SORT(a.name, b.name)));
            setSourceLangs(sourceLangMap);
        });
    };

    useEffect(() => {
        refresh();
        const subscription = on_db_languages_update.subscribe(() => refresh());

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    return (
        <Dialog open={!closed} onClose={handleClose} fullWidth maxWidth="sm">
            <DialogTitleWithClose handleClose={handleClose}>{t('source_str')}</DialogTitleWithClose>
            <DialogContent dividers>
                {sorted_language_codes(Object.keys(sourceLangs)).map((lang) => (
                    <SourceFilterSection key={lang} lang={lang} sources={sourceLangs[lang] ?? []} />
                ))}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>{t('continue')}</Button>
            </DialogActions>
        </Dialog>
    );
};
