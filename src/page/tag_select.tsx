import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemSecondaryAction,
    ListItemText,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { DialogTitleWithClose, DropDownIcon, ListCheckbox } from '../component/basic';
import { DB, on_db_languages_update } from '../db';
import { useSearchStore, type TagFilterMap } from '../db-search';
import { useAppLang, useTranslation } from '../langpack';
import { get_meta_db, MetaDbTagMapping, type MetaDb } from '../meta-db';
import { useDialog } from '../preact-helpers';
import { LOCALE_SORT } from '../sort-helpers';

type TagCountMap = Record<number, number>;

interface TagWithName extends MetaDbTagMapping {
    name: string;
}

interface TagGroupData {
    code: string;
    tags: MetaDbTagMapping[];
    title?: string;
}

interface TagFilterItemProps {
    tag: TagWithName;
    tag_counts?: TagCountMap;
    filter_tags: TagFilterMap;
}

const TagFilterItem = ({ tag, tag_counts, filter_tags }: TagFilterItemProps) => {
    const [value, setValue] = useState<number | undefined>(filter_tags[tag.id]);

    useEffect(() => {
        setValue(filter_tags[tag.id]);
    }, [filter_tags, tag.id]);

    const toggleTag = () => {
        filter_tags[tag.id] = value === 0 ? undefined : value ? 0 : 1; // tristate toggling
        setValue(filter_tags[tag.id]);
    };

    return (
        <ListItem key={tag.id} disablePadding>
            <ListItemButton onClick={toggleTag}>
                <ListItemIcon>
                    <ListCheckbox indeterminate={value === 0} checked={value === 1} />
                </ListItemIcon>
                <ListItemText primary={tag.name} />
                {tag_counts && <ListItemSecondaryAction>{tag_counts[tag.id]}</ListItemSecondaryAction>}
            </ListItemButton>
        </ListItem>
    );
};

interface TagFilterSectionProps {
    tag_group: TagGroupData;
    tag_counts?: TagCountMap;
    filter_tags: TagFilterMap;
    title: string;
}

const TagFilterSection = ({ tag_group, tag_counts, filter_tags, title }: TagFilterSectionProps) => {
    const { appLang } = useAppLang();
    const [metaDb, setMetaDb] = useState<MetaDb | null>(null);
    const [showing, setShowing] = useState(false);

    useEffect(() => {
        get_meta_db().then((meta_db: MetaDb) => setMetaDb(meta_db));
    }, []);

    const getTagName = (tag_code: string) => {
        if (!metaDb) return tag_code;
        const detail = metaDb.tags[tag_code];
        const lang = appLang ?? '';
        return detail && detail[lang] ? detail[lang] : tag_code;
    };

    if (!metaDb) {
        return null;
    }

    const items: TagWithName[] = tag_group.tags
        .filter((tag) => showing || filter_tags[tag.id] !== undefined)
        .filter((tag) => !tag_counts || tag_counts[tag.id] > 0) // remove unused tags if we have counts
        .map((tag) => ({ ...tag, name: getTagName(tag.tag_code) }))
        .sort((a, b) => LOCALE_SORT(a.name, b.name));

    return (
        <List dense disablePadding>
            <ListItem disablePadding>
                <ListItemButton onClick={() => setShowing(!showing)}>
                    <ListItemText primary={<b>{title}</b>} />
                    <DropDownIcon collapsed={!showing} />
                </ListItemButton>
            </ListItem>
            {items.map((tag) => (
                <TagFilterItem key={tag.id} tag={tag} tag_counts={tag_counts} filter_tags={filter_tags} />
            ))}
        </List>
    );
};

export interface PageTagSelectProps {
    onClose?: () => void;
}

export const PageTagSelect = ({ onClose }: PageTagSelectProps) => {
    const { t } = useTranslation();
    const { appLang } = useAppLang();
    const storedFilterTags = useSearchStore((state) => state.tags);

    const [filterTags, setFilterTags] = useState<TagFilterMap>({});
    const [tagGroups, setTagGroups] = useState<TagGroupData[]>([]);
    const [metaDb, setMetaDb] = useState<MetaDb | null>(null);
    const [tagCounts, setTagCounts] = useState<TagCountMap | undefined>();

    const handleDialogClose = () => {
        useSearchStore.getState().updateTagFilter(filterTags);
        if (onClose) {
            onClose();
        }
    };

    const { closed, handleClose } = useDialog(handleDialogClose);

    const refreshCounts = async () => {
        const db = await DB;
        const tag_counts = await db.get_tag_counts();
        if (Object.keys(tag_counts).length > 0) {
            setTagCounts(tag_counts);
        }
    };

    useEffect(() => {
        refreshCounts();
        const watcher = on_db_languages_update.subscribe(() => refreshCounts());

        return () => {
            watcher.unsubscribe();
        };
    }, []);

    useEffect(() => {
        // Cache filter_tags so we only execute on close
        setFilterTags({ ...storedFilterTags });
    }, [storedFilterTags]);

    useEffect(() => {
        get_meta_db().then((meta_db: MetaDb) => {
            const tag_groups: Record<string, TagGroupData> = {};

            Object.keys(meta_db.tag_mappings).forEach((tag_id) => {
                const tag = meta_db.tag_mappings[tag_id];
                if (!tag_groups[tag.tag_group]) {
                    tag_groups[tag.tag_group] = {
                        code: tag.tag_group,
                        tags: [],
                    };
                }
                tag_groups[tag.tag_group].tags.push(tag);
            });

            // Flatten into an array now we uniq'd the values properly
            setTagGroups(Object.values(tag_groups));
            setMetaDb(meta_db);
        });
    }, []);

    // Sort groups alphabetically
    const sortedGroups = (tagGroups || [])
        .map((tag_group) => ({ ...tag_group, title: metaDb?.tag_groups[tag_group.code]?.[appLang ?? ''] ?? tag_group.code }))
        .sort((a, b) => LOCALE_SORT(a.title, b.title));

    return (
        <Dialog open={!closed} onClose={handleClose} fullWidth maxWidth="sm">
            <DialogTitleWithClose handleClose={handleClose}>{t('tag_str')}</DialogTitleWithClose>
            <DialogContent dividers>
                {sortedGroups.map((tag_group) => (
                    <TagFilterSection key={tag_group.code} title={tag_group.title} tag_group={tag_group} tag_counts={tagCounts} filter_tags={filterTags} />
                ))}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>{t('continue')}</Button>
            </DialogActions>
        </Dialog>
    );
};
