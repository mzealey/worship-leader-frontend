import { Box, Button, ButtonGroup, useTheme } from '@mui/material';
import { ComponentType, Fragment, ReactElement, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { create } from 'zustand';
import { match_media_watcher } from '../globals';
import { useTranslation } from '../langpack';
import { usePagePadding } from '../page-padding';
import { PageEditTextarea } from '../page/edit';
import { Link } from '../preact-helpers';
import * as Icon from './icons';
import { Theme } from './theme';

import type { SvgIconProps } from '@mui/material/SvgIcon';

export interface LastButtonHandlerComponent {
    icon: ComponentType<SvgIconProps>;
    title: string;
    component: (props: Record<string, unknown> & { onClose: () => void }) => ReactElement;
}

interface LastButtonHandler {
    handler: LastButtonHandlerComponent | undefined;
    set: (newState: LastButtonHandlerComponent | undefined) => void;
}

export const useLastButtonHandler = create<LastButtonHandler>((set) => ({
    handler: undefined,
    set: (handler) => set({ handler }),
}));

const MOBILE_BOTTOM_HEIGHT = 50;
const DESKTOP_HEADER_HEIGHT = 60;

interface TopButtonProps extends Omit<React.ComponentProps<typeof Button>, 'component'> {
    children: React.ReactNode;
    to: string;
}

function TopButton({ children, to, ...props }: TopButtonProps) {
    const location = useLocation();
    const buttonProps: Partial<React.ComponentProps<typeof Button>> = { ...props };
    if (location.pathname == to) {
        buttonProps.variant = 'contained';
        buttonProps.color = 'primary';
    }
    return (
        <Button component={Link} to={to} sx={{ mx: 1 }} {...buttonProps}>
            {children}
        </Button>
    );
}

interface BottomButtonProps extends Omit<React.ComponentProps<typeof Button>, 'component'> {
    to?: string;
    icon: ComponentType<SvgIconProps>;
    scaleSize?: number;
    title?: string;
}

function _BottomButton({ to, icon: ThisIcon, scaleSize = 1, ...props }: BottomButtonProps) {
    const location = useLocation();
    const isActive = to && location.pathname == to;
    const buttonProps: Record<string, unknown> = { ...props };
    if (to) buttonProps.component = Link;

    return (
        <Button component={Link} to={to} {...buttonProps}>
            <Box
                component={ThisIcon}
                sx={{
                    fontSize: scaleSize * 24,
                    opacity: 0.5,
                    transition: 'opacity 0.5s linear, transform 0.5s linear',
                    transform: 'scale(1)',
                    ...(isActive && {
                        opacity: 1,
                        transform: 'scale(1.5)',
                    }),
                }}
            />
        </Button>
    );
}
const BottomButton = _BottomButton;

// External props that can be passed from outside
export interface PagesContainerProps {
    children?: React.ReactNode;
}

const defaultLastButtonHandler: LastButtonHandlerComponent = {
    icon: Icon.NewSong,
    title: 'newbtn',
    component: (props: Record<string, unknown>) => <PageEditTextarea type="new" {...props} />,
};

function _PagesContainer({ children }: PagesContainerProps) {
    const { t } = useTranslation();
    const theme = useTheme();
    const { handler: lastButtonHandler } = useLastButtonHandler();

    const [desktop_mode, setDesktopMode] = useState(false);
    const [show_new, setShowNew] = useState(false);

    const resetPagePadding = usePagePadding((s) => s.reset);
    useEffect(() => {
        const watcher = match_media_watcher(theme.breakpoints.down('sm'), (e: MediaQueryListEvent | MediaQueryList) => {
            setDesktopMode(!e.matches);
            resetPagePadding(e.matches ? { bottom: MOBILE_BOTTOM_HEIGHT } : { top: DESKTOP_HEADER_HEIGHT });
        });

        return watcher?.unsubscribe;
    }, [theme]);

    const new_btn: LastButtonHandlerComponent = lastButtonHandler || defaultLastButtonHandler;
    const AddComponent = new_btn.component;

    return (
        <Fragment>
            {desktop_mode && (
                <Fragment>
                    <Box
                        position="fixed"
                        display="flex"
                        alignItems="center"
                        displayPrint="none"
                        sx={(theme) => ({
                            zIndex: theme.zIndex.appBar,
                            height: DESKTOP_HEADER_HEIGHT,
                            width: '100%',
                            backgroundColor: theme.palette.background.default,
                        })}
                    >
                        <Icon.Logo color="primary" style={{ width: 'auto', height: 36, marginLeft: 30 }} />
                        <Box display="inline" marginLeft="auto">
                            <Theme section="Top">
                                <TopButton to="/" startIcon={<Icon.List />}>
                                    {t('songlist')}
                                </TopButton>
                                <TopButton to="/set-list" startIcon={<Icon.Set />}>
                                    {t('set_list')}
                                </TopButton>
                                <TopButton to="/settings" startIcon={<Icon.Settings />}>
                                    {t('settings')}
                                </TopButton>
                                <TopButton to="/add-song" startIcon={<Icon.NewSong />}>
                                    {t('newbtn')}
                                </TopButton>
                            </Theme>
                        </Box>
                    </Box>
                    <Box displayPrint="none" style={{ height: DESKTOP_HEADER_HEIGHT }} />
                </Fragment>
            )}

            {/* preact bug requires div wrap here otherwise padding can go before it */}
            <div>{children}</div>

            {show_new && <AddComponent onClose={() => setShowNew(false)} />}

            {!desktop_mode && (
                <Fragment>
                    <Box displayPrint="none" style={{ height: MOBILE_BOTTOM_HEIGHT }} />
                    <Box
                        position="fixed"
                        displayPrint="none"
                        sx={(theme) => ({
                            zIndex: theme.zIndex.appBar,
                            bottom: 0,
                            height: MOBILE_BOTTOM_HEIGHT,
                            width: '100%',
                        })}
                    >
                        <Theme section="Bottom">
                            <ButtonGroup fullWidth variant="contained" color="primary" sx={{ height: MOBILE_BOTTOM_HEIGHT }}>
                                <BottomButton to="/" title={t('songlist')} icon={Icon.List} />
                                <BottomButton to="/set-list" title={t('set_list')} icon={Icon.Set} />
                                <BottomButton scaleSize={1.6} icon={Icon.Logo} />
                                <BottomButton to="/settings" title={t('settings')} icon={Icon.Settings} />
                                <BottomButton title={t(new_btn.title)} icon={new_btn.icon} onClick={() => setShowNew(true)} />
                            </ButtonGroup>
                        </Theme>
                    </Box>
                </Fragment>
            )}
        </Fragment>
    );
}

export const PagesContainer: ComponentType<PagesContainerProps> = _PagesContainer;
