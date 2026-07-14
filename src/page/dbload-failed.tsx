import { Box, Button, Typography } from '@mui/material';
import { TopBar } from '../component/top-bar';
import { useTranslation } from '../langpack';

export const PageDbLoadFailed = () => {
    const { t } = useTranslation();

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <TopBar title={t('dbload-failed-title')} noMenu />
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 3 }}>
                <Typography variant="h5" gutterBottom>
                    {t('dbload-failed-title')}
                </Typography>
                <Typography variant="body1" sx={{ mb: 3, textAlign: 'center', maxWidth: 500 }}>
                    {t('dbload-failed')}
                </Typography>
                <Button variant="contained" color="primary" size="large" onClick={() => window.location.reload()}>
                    {t('retry')}
                </Button>
            </Box>
        </Box>
    );
};
