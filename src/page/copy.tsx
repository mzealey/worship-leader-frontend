import { Button, Dialog, DialogActions, DialogContent } from '@mui/material';
import { useState } from 'react';
import { DialogTitleWithClose } from '../component/basic';
import { ContentEditable } from '../component/content-editable';
import { useTranslation } from '../langpack';
import { useDialog } from '../preact-helpers';
import { Song } from '../song';
import { convert_to_pre } from '../songxml-util';
import { EditTypeChooser } from './edit';

interface PageCopyTextareaProps {
    song: Song;
    onClose?: () => void;
}

export const PageCopyTextarea = ({ song, onClose }: PageCopyTextareaProps) => {
    const { t } = useTranslation();
    const { closed, handleClose } = useDialog(onClose);
    const [type, setType] = useState('chords');

    return (
        <Dialog open={!closed} onClose={handleClose} fullWidth maxWidth="md">
            <DialogTitleWithClose handleClose={handleClose}>{t('copybtn')}</DialogTitleWithClose>
            <DialogContent>
                <EditTypeChooser onChange={(newType: string) => setType(newType)} format={type} />

                <ContentEditable content={convert_to_pre(song.songxml, type === 'opensong', true)} />
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>{t('cancel_btn')}</Button>
            </DialogActions>
        </Dialog>
    );
};
