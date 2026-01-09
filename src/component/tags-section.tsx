import { Chip } from '@mui/material';
import { useEffect, useState } from 'react';
import { useSearchStore } from '../db-search';
import { useAppLang } from '../langpack';
import { get_meta_db, type MetaDb } from '../meta-db';

interface TranslatedTag {
    label: string;
    id: number;
    code: string;
}

interface TagButtonProps {
    tag: TranslatedTag;
    on_filter_change?: () => void;
}

function TagButton(props: TagButtonProps) {
    const { tag, on_filter_change } = props;
    const is_filtered = useSearchStore((state) => state.tags[tag.id]);

    const onClick = () => {
        const updateTagFilter = (val: 1 | undefined) => useSearchStore.getState().updateTagFilter({ [tag.id]: val });
        updateTagFilter(is_filtered ? undefined : 1); // No negation needed here - just toggle between on/off
        if (!is_filtered)
            // no need to trigger a change if we are removing the filter
            on_filter_change?.();
    };

    return <Chip size="small" label={tag.label} color={is_filtered ? 'primary' : 'default'} onClick={onClick} style={{ marginRight: 4 }} />;
}

export interface TagsSectionProps {
    tags?: number[];
    on_filter_change?: () => void;
}

export function TagsSection(props: TagsSectionProps) {
    const { tags, on_filter_change } = props;
    const { appLang } = useAppLang();
    const [meta_db, setMetaDb] = useState<MetaDb | undefined>(undefined);

    useEffect(() => {
        get_meta_db().then((meta_db: MetaDb) => setMetaDb(meta_db));
    }, []);

    if (!meta_db || !appLang || !tags || tags.length === 0) return null;

    const translated_tags: TranslatedTag[] = tags
        .map((tag_id) => {
            const tag_code = meta_db.tag_mappings[tag_id]?.tag_code;
            if (!tag_code) return;

            return {
                label: meta_db.tags[tag_code]?.[appLang] || tag_code,
                id: tag_id,
                code: tag_code,
            };
        })
        .filter((tag) => !!tag);

    return (
        <>
            {translated_tags.map((tag) => (
                <TagButton key={tag.id} tag={tag} on_filter_change={on_filter_change} />
            ))}
        </>
    );
}
