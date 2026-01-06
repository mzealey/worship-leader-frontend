import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { useDialog } from '../preact-helpers';

interface AlertProps {
    title?: string;
    message: string;
    onClose?: () => void;
}

export const Alert = ({ title, message, onClose }: AlertProps) => {
    const { closed, handleClose } = useDialog(onClose);

    return (
        <Dialog open={!closed} onClose={handleClose}>
            {title && <DialogTitle>{title}</DialogTitle>}
            <DialogContent>
                <DialogContentText>{message}</DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} color="primary">
                    OK
                </Button>
            </DialogActions>
        </Dialog>
    );
};
