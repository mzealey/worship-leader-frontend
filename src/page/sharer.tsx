import { Button, Dialog, DialogActions, DialogContent, DialogContentText, List, ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { useEffect, useState } from 'react';
import { DialogTitleWithClose } from '../component/basic';
import * as Icon from '../component/icons';
import { LockScreen } from '../component/lock-screen';
import { get_main_domain } from '../globals';
import { useTranslation } from '../langpack';
import { useDialog } from '../preact-helpers';
import { generate_search_params, is_cordova, is_mobile_browser, normalize_url } from '../util';

export interface PageSharerProps {
    url: string;
    subject: string;
    title: string;
    file?: string;
    onClose?: (_success: number) => void;
}

export const PageSharer = ({ url: propUrl, subject, title, file, onClose }: PageSharerProps) => {
    const { t } = useTranslation();
    const handleDialogClose = () => {
        if (onClose) {
            onClose(0);
        }
    };
    const { closed, handleClose } = useDialog(handleDialogClose);
    const [lockScreen, setLockScreen] = useState<boolean>(false);
    const [useReactSharer, setUseReactSharer] = useState<boolean>(false);

    const signalClose = (success: number) => {
        if (onClose) {
            onClose(success);
        }
    };

    const closeWithShare = () => signalClose(1);
    const closeNoShare = () => {
        signalClose(0);
        handleClose();
    };

    const getUrl = () => normalize_url(propUrl, get_main_domain());

    useEffect(() => {
        const url = getUrl();

        // SocialSharing-PhoneGap-Plugin
        if (is_cordova() && window.plugins.socialsharing) {
            let options: {
                message: string;
                url: string;
                subject: string;
                chooserTitle: string;
                files?: string[];
            } = {
                message: `${subject}: ${url}`,
                url,
                subject,
                chooserTitle: title,
            };

            // Note that on android at least, socialsharing downloads these files
            // locally and then sends them rather than just sharing as a link
            // attachement. See my issue at
            // https://github.com/EddyVerbruggen/SocialSharing-PhoneGap-Plugin/issues/1006
            // for notes about why we need to decodeURI this.
            if (file) {
                options.files = [window.decodeURI(file)];
            }

            setLockScreen(true);
            let promise = new Promise((resolve, reject) =>
                window.plugins.socialsharing.shareWithOptions(
                    options,
                    () => {
                        signalClose(1);
                        resolve(1);
                    },
                    () => {
                        signalClose(0);
                        reject(1);
                    },
                ),
            );
            promise.finally(() => setLockScreen(false));
            return;
        }

        const showSharerPage = () => setUseReactSharer(true);

        if (BUILD_TYPE != 'www' && 'share' in window.navigator) {
            let options = { title, url, text: subject };
            if (file) {
                options.text += ` ${url}`;
                options.url = file;
            }

            setLockScreen(true);

            new Promise((resolve, reject) => {
                // https://wicg.github.io/web-share/ (only works on https)
                // Fallback to js if sharing failed for some reason
                window.navigator.share(options).then(() => resolve(1), reject);

                // capture the back/click-off action as per
                // https://stackoverflow.com/questions/49663206/navigator-share-wont-resolve-nor-reject-when-user-cancels-native-selector-on-an
                const cancel = () =>
                    setTimeout(() => {
                        window.removeEventListener('focus', cancel);
                        resolve(0);
                    }, 100);
                window.addEventListener('focus', cancel);
            })
                .then((result) => signalClose(result as number), showSharerPage)
                .finally(() => setLockScreen(false));
            return;
        }
        showSharerPage();
    }, [subject, title, file]);

    if (lockScreen) {
        return <LockScreen />;
    }

    if (!useReactSharer) {
        // either using native sharer or not sure if we need to use it or not - dont render anything yet
        return null;
    }

    let displaySubject = subject;
    let displayUrl = getUrl();

    if (file) {
        displaySubject += ` ${displayUrl}`;
        displayUrl = file;
    }

    let urlAndMsg = `${displaySubject}: ${displayUrl}`;

    // mailto doesn't seem to like uri-encoded stuff in kmail but tbird etc work ok

    // alternative facebook url needs an app id
    //$('#share-facebook').attr('href', 'https://www.facebook.com/dialog/share?' + generate_search_params({ display: 'popup', href: url }) );

    return (
        <Dialog open={!closed} onClose={closeNoShare}>
            <DialogTitleWithClose handleClose={closeNoShare}>{t('sharebtn')}</DialogTitleWithClose>
            <DialogContent>
                <DialogContentText>{t('share_title')}</DialogContentText>

                <List>
                    <ListItem disablePadding>
                        <ListItemButton
                            component="a"
                            onClick={closeWithShare}
                            href={'mailto:?' + generate_search_params({ subject: displaySubject, body: displayUrl })}
                        >
                            <ListItemIcon>
                                <Icon.ShareEmail />
                            </ListItemIcon>
                            <ListItemText primary={t('email')} />
                        </ListItemButton>
                    </ListItem>

                    {is_mobile_browser() && (
                        <ListItem disablePadding>
                            <ListItemButton
                                component="a"
                                target="_blank"
                                onClick={closeWithShare}
                                rel="noopener noreferrer"
                                data-action="share/whatsapp/share"
                                href={'whatsapp://send?' + generate_search_params({ text: urlAndMsg })}
                            >
                                <ListItemIcon>
                                    <Icon.ShareWhatsApp />
                                </ListItemIcon>
                                <ListItemText primary={t('whatsapp')} />
                            </ListItemButton>
                        </ListItem>
                    )}

                    <ListItem disablePadding>
                        <ListItemButton
                            component="a"
                            target="_blank"
                            onClick={closeWithShare}
                            rel="noopener noreferrer"
                            href={'https://www.facebook.com/sharer/sharer.php?' + generate_search_params({ u: displayUrl, caption: t('worship-leader') })}
                        >
                            <ListItemIcon>
                                <Icon.ShareFacebook />
                            </ListItemIcon>
                            <ListItemText primary={t('facebook')} />
                        </ListItemButton>
                    </ListItem>

                    {is_mobile_browser() && (
                        <ListItem disablePadding>
                            <ListItemButton component="a" onClick={closeWithShare} href={'sms:?' + generate_search_params({ body: urlAndMsg })}>
                                <ListItemIcon>
                                    <Icon.ShareSMS />
                                </ListItemIcon>
                                <ListItemText primary={t('sms')} />
                            </ListItemButton>
                        </ListItem>
                    )}
                    <ListItem disablePadding>
                        <ListItemButton
                            component="a"
                            onClick={closeWithShare}
                            target="_blank"
                            rel="noopener noreferrer"
                            href={'https://vk.com/share.php?' + generate_search_params({ url: displayUrl, title: displaySubject })}
                        >
                            <ListItemIcon>
                                <Icon.ShareVK />
                            </ListItemIcon>
                            <ListItemText primary={t('vk')} />
                        </ListItemButton>
                    </ListItem>
                </List>

                <label htmlFor="share-link">{t('copy_link')}</label>
                <input readOnly id="share-link" onClick={(e) => (e.target as HTMLInputElement).select()} value={displayUrl} />
            </DialogContent>
            <DialogActions>
                <Button onClick={closeNoShare}>{t('cancel_btn')}</Button>
            </DialogActions>
        </Dialog>
    );
};
