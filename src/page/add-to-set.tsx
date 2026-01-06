import { Button, Dialog, DialogActions, DialogContent, List, ListItem, ListItemButton, ListItemSecondaryAction, ListItemText } from '@mui/material';
import { useEffect, useState } from 'react';
import { Alert } from '../component/alert';
import { AutofocusTextField, DialogTitleWithClose } from '../component/basic';
import { song_feedback } from '../feedback';
import { useTranslation } from '../langpack';
import { useDialog } from '../preact-helpers';
import { SET_DB, on_set_db_update } from '../set-db';

interface SetItem {
    id: number;
    name: string;
    total?: number;
    ro?: 0 | 1;
}

interface AddToSetListProps {
    add_to_set?: (set_id: number) => void;
}

const AddToSetList = ({ add_to_set }: AddToSetListProps) => {
    const [sets, setSets] = useState<SetItem[]>([]);

    useEffect(() => {
        const doUpdate = () => {
            SET_DB.get_set_list().then((sets) => setSets([...sets]));
        };

        const subscription = on_set_db_update.subscribe(() => doUpdate());
        doUpdate();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const filteredSets = sets.filter((set) => !set.ro);
    if (!filteredSets.length) return null;

    return (
        <DialogContent dividers>
            <List disablePadding>
                {filteredSets.map((set) => (
                    <ListItem divider key={set.id} disablePadding>
                        <ListItemButton onClick={() => add_to_set?.(set.id)}>
                            <ListItemText primary={set.name} />
                            <ListItemSecondaryAction>{set.total}</ListItemSecondaryAction>
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
        </DialogContent>
    );
};

interface DialogAddToSetProps {
    song_id: number;
    transpose?: {
        keyName: string;
        capo: number;
    };
    onClose?: () => void;
}

export const DialogAddToSet = ({ song_id, transpose, onClose }: DialogAddToSetProps) => {
    const { t } = useTranslation();
    const { closed, handleClose } = useDialog(onClose);
    const [setName, setSetName] = useState('');
    const [duplicate, setDuplicate] = useState(false);

    const addSongToSet = (set_id: number) => {
        song_feedback('set_add', song_id);
        return SET_DB.add_song_to_set(set_id, song_id, transpose ? transpose.keyName : '', transpose ? transpose.capo : 0);
    };

    const createSet = () =>
        SET_DB.create_set(setName)
            .then((new_set_id) => addSongToSet(new_set_id))
            .finally(handleClose);

    const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const set_name = (e.target as HTMLInputElement).value || '';
        setSetName(set_name);
        if (set_name.length && e.keyCode === 13) createSet();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSetName(e.target.value || '');
    };

    return (
        <Dialog open={!closed} onClose={handleClose}>
            <DialogTitleWithClose handleClose={handleClose}>{t('add_song_to_set')}</DialogTitleWithClose>

            <DialogContent sx={{ flexShrink: 0, pt: 3, pb: 3 }}>
                <AutofocusTextField label={t('set_name')} fullWidth value={setName} onKeyUp={handleKeyUp} onChange={handleChange} sx={{ mt: 1 }} />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button variant="contained" color="primary" disabled={!setName.length} onClick={createSet}>
                    {t('set_create')}
                </Button>
            </DialogActions>

            <AddToSetList add_to_set={(set_id) => addSongToSet(set_id).then(handleClose, () => setDuplicate(true))} />

            {duplicate && <Alert message={t('already_in_set')} onClose={() => setDuplicate(false)} />}
        </Dialog>
    );
};
