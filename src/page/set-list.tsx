import { IconButton, List, ListItem, ListItemButton, ListItemSecondaryAction, ListItemText } from '@mui/material';
import { Fragment, useEffect, useState } from 'react';
import * as Icon from '../component/icons';
import { TopBar } from '../component/top-bar';
import { useTranslation } from '../langpack';
import { Link } from '../preact-helpers';
import { SET_DB, on_set_db_update } from '../set-db';
import { PageSetDelete } from './dialog-set-delete';
import { PageSetRename } from './dialog-set-rename';

interface SetItem {
    id: number;
    name: string;
    total?: number;
    ro?: 0 | 1;
    shared_live?: 0 | 1;
    live?: 0 | 1;
}

// Custom hook to replace SetWatcher
const useSetWatcher = () => {
    const [sets, setSets] = useState<SetItem[]>([]);

    useEffect(() => {
        const doUpdate = () => {
            SET_DB.get_set_list().then((sets) => setSets([...sets]));
        };

        doUpdate();
        const sub = on_set_db_update.subscribe(() => doUpdate());

        return () => {
            sub.unsubscribe();
        };
    }, []);

    return sets;
};

interface SetListItemProps {
    withActions?: boolean;
    set: SetItem;
    divider?: boolean;
}

const SetListItem = ({ withActions, set, ...props }: SetListItemProps) => {
    const { t } = useTranslation();
    const [showDelete, setShowDelete] = useState(false);
    const [showRename, setShowRename] = useState(false);

    return (
        <Fragment>
            {showDelete && <PageSetDelete set_id={set.id} onClose={() => setShowDelete(false)} />}
            {showRename && <PageSetRename set_id={set.id} onClose={() => setShowRename(false)} />}

            <ListItem key={set.id} disablePadding>
                <ListItemButton component={Link} to={`/set-view/${set.id}`} {...props}>
                    <ListItemText
                        primary={
                            <span>
                                {set.name} {(set.shared_live || set.live) && <Icon.LiveSet />}
                            </span>
                        }
                    />

                    <ListItemSecondaryAction style={{ right: 0 }}>
                        {set.total}
                        {withActions && (
                            <span style={{ marginLeft: 12 }}>
                                {!set.ro && (
                                    <IconButton onClick={() => setShowRename(true)} title={t('rename_set')}>
                                        <Icon.Rename />
                                    </IconButton>
                                )}

                                <IconButton onClick={() => setShowDelete(true)} title={t('delete_set_btn')}>
                                    <Icon.Delete />
                                </IconButton>
                            </span>
                        )}
                    </ListItemSecondaryAction>
                </ListItemButton>
            </ListItem>
        </Fragment>
    );
};

interface SetListProps {
    withActions?: boolean;
    noEmptyText?: boolean;
    maxItems?: number;
    divider?: boolean;
}

export const SetList = ({ withActions, noEmptyText, maxItems, divider }: SetListProps) => {
    const { t } = useTranslation();
    let sets = useSetWatcher();

    if (!sets.length) {
        return noEmptyText ? null : <p>{t('no-sets')}</p>;
    }

    if (maxItems) {
        sets = sets.slice(0, maxItems);
    }

    return (
        <List disablePadding>
            {sets.map((set) => (
                <SetListItem key={set.id} withActions={withActions} set={set} divider={divider} />
            ))}
        </List>
    );
};

export const PageSetList = () => {
    const { t } = useTranslation();
    return (
        <div>
            <TopBar title={t('sets')} />

            <SetList withActions divider />
        </div>
    );
};
