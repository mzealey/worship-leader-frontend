import { Button, Grid } from '@mui/material';
import { ThinPage } from '../component/basic';
import { TopBar } from '../component/top-bar';
import { UILanguageChooser } from '../component/uilanguagechooser';
import { useTranslation } from '../langpack';

export const PageFirsttimeWelcome = ({ onComplete }: { onComplete: () => void }) => {
    const { t } = useTranslation();

    return (
        <ThinPage>
            <TopBar title={t('firsttime_welcome_title')} noMenu />
            <Grid container spacing={2} sx={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center' }}>
                <Grid>
                    <p>{t('firsttime_welcome')}</p>

                    <p>{t('choose_lang_msg')}</p>
                </Grid>

                <Grid>
                    <UILanguageChooser fullWidth />
                </Grid>

                <Grid>
                    <Button onClick={onComplete} size="large" variant="contained" color="primary" fullWidth>
                        {t('continue')}
                    </Button>
                </Grid>
            </Grid>
        </ThinPage>
    );
};
