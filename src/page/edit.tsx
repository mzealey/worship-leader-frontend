import { Button, Dialog, DialogActions, DialogContent, DialogContentText, Grid, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from '../component/alert';
import { DialogTitleWithClose } from '../component/basic';
import { ContentEditable } from '../component/content-editable';
import { LockScreen } from '../component/lock-screen';
import { send_ui_notification } from '../component/notification';
import { get_host, get_uuid } from '../globals';
import { useTranslation } from '../langpack';
import { Song } from '../song';
import { convert_to_elvanto, convert_to_pre } from '../songxml-util';
import { fetch_json } from '../util';

interface EditTypeChooserProps {
    format: string;
    onChange: (format: string) => void;
    elvanto?: number;
}

export const EditTypeChooser = ({ format, onChange, elvanto }: EditTypeChooserProps) => {
    const { t } = useTranslation();

    return (
        <Grid container>
            <legend>{t('edit_format')}</legend>
            <Grid size="grow">
                <ToggleButtonGroup fullWidth value={format} exclusive onChange={(_e, value) => onChange(value)}>
                    <ToggleButton value="chords">{t('edit_chords')}</ToggleButton>
                    <ToggleButton value="opensong">{t('edit_opensong')}</ToggleButton>
                    {elvanto && <ToggleButton value="elvanto">Elvanto</ToggleButton>}
                </ToggleButtonGroup>
            </Grid>
        </Grid>
    );
};

interface PageEditTextareaProps {
    type: string;
    song?: Song;
    onClose?: () => void;
}

export const PageEditTextarea = ({ type, song, onClose }: PageEditTextareaProps) => {
    const { t } = useTranslation();
    const [format, setFormat] = useState('chords');
    const [closed, setClosed] = useState(false);
    const [orig, setOrig] = useState('');
    const [cont, setCont] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitFailed, setSubmitFailed] = useState(false);

    const handleClose = () => {
        setClosed(true);
        if (onClose) {
            onClose();
        }
    };

    const updateCont = useCallback(
        (force?: boolean) => {
            if (type === 'new' && !force) {
                return;
            }

            let newCont = t('edit_email') + ': \n';

            if (type === 'new') {
                newCont += t('edit_song_title') + ': \n\n\n';
            } else if (song) {
                newCont += t('edit_song_title') + ': ' + song.title + '\n\n';
                newCont += t('edit_lyrics') + ':\n\n';
                if (format === 'elvanto') {
                    newCont += convert_to_elvanto(song.songxml);
                } else {
                    newCont += convert_to_pre(song.songxml, format === 'opensong');
                }
            }

            setOrig(newCont);
            setCont(newCont);
        },
        [t, song, type, format],
    );

    useEffect(() => {
        updateCont(true);
    }, [updateCont]);

    const onSubmit = useCallback(
        (e: React.FormEvent | React.MouseEvent) => {
            e.preventDefault();

            const success = () => {
                send_ui_notification({ message_code: 'edit_submit_success' });
                handleClose();
            };

            if (orig === cont) {
                // Not changed
                return success();
            }

            let send_data = cont;
            let origData = orig;
            if (type === 'edit' && song) {
                const orig_title = song.title;
                const prepend = `song_id: ${song.id}\n` + `orig_title: ${orig_title}\n\n`;
                send_data = prepend + send_data;
                origData = prepend + origData;
            } else {
                origData = '';
            }

            const form_data = new FormData();
            form_data.append('orig', origData);
            form_data.append('form', send_data);
            form_data.append('format', format);
            form_data.append('uuid', get_uuid());

            setSubmitting(true);
            fetch_json(get_host() + '/api/app/song_upload', { method: 'POST', body: form_data })
                .then(success, () => setSubmitFailed(true))
                .finally(() => setSubmitting(false));
        },
        [t, orig, cont, type, song, format, handleClose],
    );

    const formatChange = (newFormat: string) => {
        setFormat(newFormat);
        // Will be picked up by updateCont effect
    };

    // Update content when format changes
    useEffect(() => {
        if (format !== 'chords') {
            // Skip initial render
            updateCont(false);
        }
    }, [format, updateCont]);

    if (submitting) {
        return <LockScreen />;
    }

    return (
        <form onSubmit={onSubmit}>
            <Dialog open={!closed} onClose={handleClose} fullWidth maxWidth="md">
                <DialogTitleWithClose handleClose={handleClose}>{t(type === 'new' ? 'newbtn' : 'editbtn')}</DialogTitleWithClose>
                <DialogContent>
                    <DialogContentText dangerouslySetInnerHTML={{ __html: t('edit_welcome_text') }} />

                    <EditTypeChooser onChange={formatChange} format={format} elvanto={1} />

                    <ContentEditable content={cont} onChange={setCont} autofocus />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>{t('cancel_btn')}</Button>
                    <Button onClick={onSubmit} color="primary">
                        {t('editsubmit')}
                    </Button>
                </DialogActions>

                {submitFailed && <Alert message={t('edit_submit_failed')} onClose={() => setSubmitFailed(false)} />}
            </Dialog>
        </form>
    );
};
