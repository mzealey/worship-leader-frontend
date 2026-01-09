import { Button, Dialog, DialogActions, DialogContent, DialogContentText } from '@mui/material';
import { DialogTitleWithClose } from '../component/basic';
import { useTranslation } from '../langpack';
import { useDialog } from '../preact-helpers';
import { SET_DB } from '../set-db';

interface PageSetDeleteProps {
    set_id: number;
    onClose?: () => void;
}

export const PageSetDelete = ({ set_id, onClose }: PageSetDeleteProps) => {
    const { t } = useTranslation();
    const { closed, handleClose } = useDialog(onClose);

    const doDelete = () => {
        SET_DB.delete_set(set_id);
        handleClose();
    };

    return (
        <Dialog open={!closed} onClose={handleClose}>
            <DialogTitleWithClose handleClose={handleClose}>{t('delete_set')}</DialogTitleWithClose>
            <DialogContent>
                <DialogContentText>{t('delete_set_confirm')}</DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>{t('cancel_btn')}</Button>
                <Button color="primary" onClick={doDelete}>
                    {t('delete_set_btn')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
