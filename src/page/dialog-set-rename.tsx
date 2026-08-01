import { Button, Dialog, DialogActions, DialogContent } from '@mui/material';
import { useEffect, useState } from 'react';
import { AutofocusTextField, DialogTitleWithClose } from '../component/basic';
import { useTranslation } from '../langpack';
import { SET_DB } from '../set-db';
import { useDialog } from '../use-dialog';

interface PageSetRenameProps {
    set_id: number;
    onClose?: () => void;
}

export const PageSetRename = ({ set_id, onClose }: PageSetRenameProps) => {
    const { t } = useTranslation();
    const { closed, handleClose } = useDialog(onClose);
    const [setName, setSetName] = useState('');

    useEffect(() => {
        SET_DB.get_set_title(set_id).then((title) => setSetName(title || ''));
    }, [set_id]);

    const doRename = () => {
        SET_DB.rename_set(set_id, setName).finally(handleClose);
    };

    return (
        <Dialog open={!closed} onClose={handleClose}>
            <DialogTitleWithClose handleClose={handleClose}>{t('rename_set')}</DialogTitleWithClose>
            <DialogContent>
                <AutofocusTextField
                    label={t('set_name')}
                    fullWidth
                    value={setName}
                    onKeyUp={(e: React.KeyboardEvent<HTMLInputElement>) => setSetName((e.target as HTMLInputElement).value)}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSetName(e.target.value)}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>{t('cancel_btn')}</Button>
                <Button color="primary" onClick={doRename} disabled={!setName.length}>
                    {t('rename_set_btn')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
