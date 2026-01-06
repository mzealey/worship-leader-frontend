import { Button, Dialog, DialogActions, DialogContent, DialogContentText } from '@mui/material';
import { useState } from 'react';
import { DialogTitleWithClose } from '../component/basic';
import { useTranslation } from '../langpack';
import { useDialog } from '../preact-helpers';
import { generate_set_share_link, type ShareableSet } from '../set-utils';
import { PageSharer } from './sharer';

interface PageSetShareProps {
    set: ShareableSet;
    onClose?: () => void;
}

export const PageSetShare = (props: PageSetShareProps) => {
    const { set, onClose } = props;
    const { t } = useTranslation();
    const { closed, handleClose } = useDialog(onClose);
    const [shareLink, setShareLink] = useState<string | undefined>(undefined);

    const doShare = (live_share: boolean) => {
        setShareLink(generate_set_share_link(set, live_share));
    };

    return (
        <Dialog open={!closed} onClose={handleClose}>
            <DialogTitleWithClose handleClose={handleClose}>{t('share-set')}</DialogTitleWithClose>
            <DialogContent>
                <DialogContentText>{t('share_set_title')}</DialogContentText>
            </DialogContent>
            {shareLink && <PageSharer url={shareLink} title={t('share_title')} subject={t('share_set_subject')} onClose={handleClose} />}
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
