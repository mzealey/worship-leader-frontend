import { AppBar, Box, IconButton, Popover, Toolbar, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { Fragment, useEffect, useState } from 'react';
import { useTranslation } from '../langpack';
import * as Icon from './icons';

interface MenuButtonProps {
    children?: ReactNode;
}

function MenuButton({ children }: MenuButtonProps) {
    const [show, setShow] = useState(false);
    const [anchorEl, setAnchorEl] = useState<any>(null);

    const on_click = (event: React.MouseEvent) => {
        setShow(!show);
        setAnchorEl(event.currentTarget);
    };

    const hide = () => setShow(false);

    // NOTE: Please make sure that any dialog showing code is handled
    // outside of this so we don't have to keep it mounted all the time
    return (
        <Fragment>
            <IconButton onClick={on_click}>
                <Icon.Menu />
            </IconButton>

            <Popover open={!!show} anchorEl={anchorEl} anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }} onClick={hide}>
                <Box
                    sx={{
                        '& > *': {
                            paddingLeft: 2,
                            paddingRight: 2,
                            display: 'flex',
                            justifyContent: 'left',
                            width: '100%',
                        },
                    }}
                >
                    {children}
                </Box>
            </Popover>
        </Fragment>
    );
}

interface TopBarProps {
    noMenu?: boolean;
    className?: string;
    menuOnly?: ReactNode;
    before?: ReactNode;
    documentTitle?: string;
    title?: ReactNode | string;
    children?: ReactNode;
    sx?: Record<string, unknown> | ((theme: any) => Record<string, unknown>);
}

export function TopBar({ sx, noMenu, className, menuOnly, before, documentTitle, title, children }: TopBarProps) {
    const { t } = useTranslation();

    const doc_title = documentTitle || (typeof title === 'string' ? title : '') || '';

    useEffect(() => {
        document.title = (doc_title ? `${doc_title} - ` : '') + t('worship-leader');
    }, [doc_title, t]);

    const show_menu = !noMenu && (children || menuOnly);
    return (
        <Box sx={{ displayPrint: 'none' }}>
            <AppBar
                color="default"
                elevation={0}
                className={className}
                sx={(theme) => ({
                    top: 'auto',
                    backgroundColor: theme.palette.background.topbar,
                    [theme.breakpoints.down('xs')]: {
                        // TODO class names
                        '& .MuiButton-root': {
                            minWidth: 36,
                            '& .text': {
                                display: 'none',
                            },
                        },
                    },
                    ...(typeof sx === 'function' ? sx(theme) : sx || {}),
                })}
            >
                <Toolbar
                    disableGutters={true}
                    sx={(theme) => ({
                        flexWrap: 'wrap',
                        overflow: 'hidden',
                        ...(show_menu && { marginRight: '50px' }),
                        ...(!show_menu && {
                            paddingRight: theme.spacing(2),
                            [theme.breakpoints.up('sm')]: {
                                paddingRight: theme.spacing(3),
                            },
                        }),
                        ...(!before && {
                            paddingLeft: theme.spacing(2),
                            [theme.breakpoints.up('sm')]: {
                                paddingLeft: theme.spacing(3),
                            },
                        }),
                    })}
                >
                    <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                        {before}

                        {!!title && <Typography variant="h6">{title}</Typography>}
                    </Box>

                    <Box sx={{ flexGrow: 1, minWidth: 16 }} />
                    {children}
                </Toolbar>
                {show_menu ? (
                    <Box sx={{ position: 'absolute', right: 0 }}>
                        <MenuButton>
                            {children}
                            {menuOnly}
                        </MenuButton>
                    </Box>
                ) : null}
            </AppBar>
            <Toolbar />
        </Box>
    );
}
