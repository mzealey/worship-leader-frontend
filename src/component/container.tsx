import { Box, Button, ButtonGroup, useTheme } from '@mui/material';
import type { ComponentType } from 'react';
import { Fragment, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { create } from 'zustand';
import { match_media_watcher } from '../globals';
import { useTranslation } from '../langpack';
import { usePagePadding } from '../page-padding';
import * as Icon from './icons';
import { Link } from './router-link';
import { Theme } from './theme';

import type { SvgIconProps } from '@mui/material/SvgIcon';

export interface LastButtonHandler {
    icon: ComponentType<SvgIconProps>;
    title: string;
    to: string;
}

interface LastButtonHandlerStore {
    handler: LastButtonHandler | undefined;
    set: (newState: LastButtonHandler | undefined) => void;
}

export const useLastButtonHandler = create<LastButtonHandlerStore>((set) => ({
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
        <Button nativeButton={false} component={Link} to={to} sx={{ mx: 1 }} {...buttonProps}>
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

function BottomButton({ to, icon: ThisIcon, scaleSize = 1, ...props }: BottomButtonProps) {
    const location = useLocation();
    const isActive = to && location.pathname == to;
    const buttonProps: Record<string, unknown> = { ...props };
    if (to) buttonProps.component = Link;

    return (
        <Button nativeButton={false} component={Link} to={to} {...buttonProps}>
            <Box
                component={ThisIcon}
                sx={{
                    fontSize: scaleSize * 24,
                    opacity: 0.5,
                    transition: 'opacity 0.5s linear, transform 0.5s linear',
                    transform: 'scale(1)',
                    willChange: 'transform',
                    ...(isActive && {
                        opacity: 1,
                        transform: 'scale(1.5)',
                    }),
                }}
            />
        </Button>
    );
}

// External props that can be passed from outside
export interface PagesContainerProps {
    children?: React.ReactNode;
}

export function PagesContainer({ children }: PagesContainerProps) {
    const { t } = useTranslation();
    const theme = useTheme();
    const { handler: lastButtonHandler } = useLastButtonHandler();

    const [desktop_mode, setDesktopMode] = useState(false);

    const resetPagePadding = usePagePadding((s) => s.reset);
    useEffect(() => {
        const watcher = match_media_watcher(theme.breakpoints.down('sm'), (e: MediaQueryListEvent | MediaQueryList) => {
            setDesktopMode(!e.matches);
            resetPagePadding(e.matches ? { bottom: MOBILE_BOTTOM_HEIGHT } : { top: DESKTOP_HEADER_HEIGHT });
        });

        return watcher?.unsubscribe;
    }, [theme, resetPagePadding]);

    return (
        <Fragment>
            {desktop_mode ? (
                <Fragment>
                    <Box
                        sx={(theme) => ({
                            position: 'fixed',
                            display: 'flex',
                            alignItems: 'center',
                            displayPrint: 'none',
                            zIndex: theme.zIndex.appBar,
                            height: DESKTOP_HEADER_HEIGHT,
                            width: '100%',
                            backgroundColor: theme.palette.background.default,
                        })}
                    >
                        <Box component={Link} to="/" sx={{ display: 'flex' }} style={{ cursor: 'pointer' }}>
                            <Icon.Logo color="primary" style={{ width: 'auto', height: 36, marginLeft: 30 }} />
                        </Box>
                        <Box sx={{ display: 'inline', marginLeft: 'auto' }}>
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
                    <Box sx={{ displayPrint: 'none' }} style={{ height: DESKTOP_HEADER_HEIGHT }} />
                </Fragment>
            ) : null}

            {/* preact bug requires div wrap here otherwise padding can go before it */}
            <div>{children}</div>

            {!desktop_mode && (
                <Fragment>
                    <Box sx={{ displayPrint: 'none' }} style={{ height: MOBILE_BOTTOM_HEIGHT }} />
                    <Box
                        sx={(theme) => ({
                            position: 'fixed',
                            displayPrint: 'none',
                            zIndex: theme.zIndex.modal + 1,
                            bottom: 0,
                            height: MOBILE_BOTTOM_HEIGHT,
                            width: '100%',
                        })}
                    >
                        <Theme section="Bottom">
                            <ButtonGroup fullWidth variant="contained" color="primary" sx={{ height: MOBILE_BOTTOM_HEIGHT }}>
                                <BottomButton to="/" title={t('songlist')} icon={Icon.List} />
                                <BottomButton to="/set-list" title={t('set_list')} icon={Icon.Set} />
                                <BottomButton to="/" scaleSize={1.6} icon={Icon.Logo} />
                                <BottomButton to="/settings" title={t('settings')} icon={Icon.Settings} />
                                <BottomButton
                                    to={lastButtonHandler?.to || '/add-song'}
                                    title={t(lastButtonHandler?.title || 'newbtn')}
                                    icon={lastButtonHandler?.icon || Icon.NewSong}
                                />
                            </ButtonGroup>
                        </Theme>
                    </Box>
                </Fragment>
            )}
        </Fragment>
    );
}
