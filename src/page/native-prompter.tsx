import { Button, Dialog, DialogActions, DialogContent, DialogContentText } from '@mui/material';
import { useEffect, useState } from 'react';
import { DialogTitleWithClose } from '../component/basic';
import { get_client_type } from '../globals';
import { useTranslation } from '../langpack';
import { get_app_dl_link, should_show_prompt } from '../platform-utils';
import { useDialog } from '../preact-helpers';
import { is_bot } from '../splash-util.es5';

interface PromptConfig {
    href?: string;
    target?: string;
    component?: string;
    onClick?: () => void;
}

export const PageNativePrompter = ({ onClose }: { onClose?: () => void }) => {
    const { t } = useTranslation();
    const { closed, handleClose: dialogHandleClose } = useDialog(onClose);
    const [prompt, setPrompt] = useState<PromptConfig | undefined>(undefined);

    const handleClose = () => {
        dialogHandleClose();
    };

    useEffect(() => {
        if (
            BUILD_TYPE !== 'www' ||
            get_client_type() !== 'www' || // only on web version (not app etc)
            is_bot() ||
            !should_show_prompt()
        ) {
            // showed prompt too recently
            return;
        }

        const link = get_app_dl_link();

        // Can be installed as a PWA. Usually fires some time after we are all set
        // up though.
        if (link) {
            // native app available for this platform
            setPrompt({ ...link, component: 'a', onClick: handleClose });
        } else {
            // No native app available - prompt the PWA install
            const handleBeforeInstallPrompt = (pwa_prompt: Event & { prompt?: () => void; userChoice?: Promise<any> }) => {
                // Prevent Chrome 67 and earlier from automatically showing the prompt
                pwa_prompt.preventDefault();

                setPrompt({
                    onClick: () => {
                        if (pwa_prompt.prompt) pwa_prompt.prompt();
                        handleClose();
                    },
                });

                // TODO: May want to watch for deferredPrompt.userChoice
                // promise to see what the result was and stop prompting after
                // that?
            };

            window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

            return () => {
                window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            };
        }
    }, []);

    if (!prompt) {
        return null;
    }

    return (
        <Dialog open={!closed} onClose={handleClose}>
            <DialogTitleWithClose handleClose={handleClose}>{t('native_prompt_title')}</DialogTitleWithClose>
            <DialogContent>
                <DialogContentText>{t('native_prompt_body')}</DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>{t('continue')}</Button>
                <Button color="primary" {...prompt}>
                    {t('native_prompt_btn')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
