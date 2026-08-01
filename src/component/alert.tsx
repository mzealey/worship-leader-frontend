import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { useTranslation } from '../langpack';
import { useDialog } from '../use-dialog';

interface AlertProps {
    title?: string;
    message: string;
    onClose?: () => void;
}

export const Alert = ({ title, message, onClose }: AlertProps) => {
    const { closed, handleClose } = useDialog(onClose);
    const { t } = useTranslation();

    return (
        <Dialog open={!closed} onClose={handleClose}>
            {title ? <DialogTitle>{title}</DialogTitle> : null}
            <DialogContent>
                <DialogContentText>{message}</DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} color="primary">
                    {t('ok')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
