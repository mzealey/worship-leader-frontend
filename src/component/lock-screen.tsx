import { Box, CircularProgress, Grid, Modal } from '@mui/material';
import { useTranslation } from '../langpack';

interface SpinnerProps {
    message_code?: string;
}

export function Spinner({ message_code }: SpinnerProps) {
    const { t } = useTranslation();
    return (
        <Grid container spacing={0} direction="column" alignItems="center" justifyContent="center" style={{ minHeight: '100vh' }}>
            <Box style={{ textAlign: 'center' }}>
                {message_code && <h3>{t(message_code)}</h3>}
                <CircularProgress />
            </Box>
        </Grid>
    );
}

export function LockScreen(props: SpinnerProps) {
    return (
        <Modal open={true}>
            <Spinner {...props} />
        </Modal>
    );
}
