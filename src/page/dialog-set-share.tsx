import { Button, Dialog, DialogActions, DialogContent, DialogContentText } from '@mui/material';
import { DialogTitleWithClose } from '../component/basic';
import { useTranslation } from '../langpack';
import { generate_set_share_link, type ShareableSet } from '../set-utils';
import { useDialog } from '../use-dialog';

interface PageSetShareProps {
    set: ShareableSet;
    onClose?: () => void;
    onShare?: (url: string) => void;
}

export const PageSetShare = (props: PageSetShareProps) => {
    const { set, onClose, onShare } = props;
    const { t } = useTranslation();
    const { closed, handleClose } = useDialog(onClose);

    const doShare = (live_share: boolean) => {
        const link = generate_set_share_link(set, live_share);
        onShare?.(link);
        onClose?.();
    };

    return (
        <Dialog open={!closed} onClose={handleClose}>
            <DialogTitleWithClose handleClose={handleClose}>{t('share-set')}</DialogTitleWithClose>
            <DialogContent>
                <DialogContentText>{t('share_set_title')}</DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>{t('cancel_btn')}</Button>
                <Button color="primary" onClick={() => doShare(true)}>
                    {t('share-set-live')}
                </Button>
                <Button color="primary" onClick={() => doShare(false)}>
                    {t('share-set-normal')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
