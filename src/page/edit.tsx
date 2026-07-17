import { Box, Button, CircularProgress, Grid, IconButton, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Alert } from '../component/alert';
import { ContentEditable } from '../component/content-editable';
import * as Icon from '../component/icons';
import { LockScreen } from '../component/lock-screen';
import { send_ui_notification } from '../component/notify';
import { TopBar } from '../component/top-bar';
import { DB } from '../db';
import { API_HOST, get_uuid } from '../globals';
import { useTranslation } from '../langpack';
import type { Song } from '../song';
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
                    {elvanto ? <ToggleButton value="elvanto">Elvanto</ToggleButton> : null}
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
    const navigate = useNavigate();
    const [format, setFormat] = useState('chords');
    const [orig, setOrig] = useState('');
    const [cont, setCont] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitFailed, setSubmitFailed] = useState(false);

    const handleClose = useCallback(() => {
        if (onClose) {
            onClose();
        }
        navigate(-1);
    }, [onClose, navigate]);

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
            fetch_json(`${API_HOST}/api/app/song_upload`, { method: 'POST', body: form_data })
                .then(success, () => setSubmitFailed(true))
                .finally(() => setSubmitting(false));
        },
        [orig, cont, type, song, format, handleClose],
    );

    const formatChange = (newFormat: string) => {
        setFormat(newFormat);
    };

    useEffect(() => {
        if (format !== 'chords') {
            updateCont(false);
        }
    }, [format, updateCont]);

    if (submitting) {
        return <LockScreen />;
    }

    return (
        <form onSubmit={onSubmit}>
            <TopBar
                title={t(type === 'new' ? 'newbtn' : 'editbtn')}
                before={
                    <IconButton onClick={handleClose} aria-label="back">
                        <Icon.Back />
                    </IconButton>
                }
            />
            <Box sx={{ maxWidth: 600, mx: 'auto', px: 2, py: 2 }}>
                <Typography variant="body1" gutterBottom dangerouslySetInnerHTML={{ __html: t('edit_welcome_text') }} />

                <EditTypeChooser onChange={formatChange} format={format} elvanto={1} />

                <Box sx={{ mt: 2, mb: 2 }}>
                    <ContentEditable content={cont} onChange={setCont} autofocus />
                </Box>

                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    <Button onClick={handleClose}>{t('cancel_btn')}</Button>
                    <Button onClick={onSubmit} color="primary" variant="contained">
                        {t('editsubmit')}
                    </Button>
                </Box>

                {submitFailed ? <Alert message={t('edit_submit_failed')} onClose={() => setSubmitFailed(false)} /> : null}
            </Box>
        </form>
    );
};

export const PageEditSong = () => {
    const { song_id } = useParams();
    const [song, setSong] = useState<Song>();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (song_id) {
            const id = parseInt(song_id, 10);
            DB.then((db) => db.get_song(id, true)).then((s) => {
                setSong(s ?? undefined);
                setLoading(false);
            });
        }
    }, [song_id]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
            </Box>
        );
    }

    return <PageEditTextarea type="edit" song={song} />;
};
