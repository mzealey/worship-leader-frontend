import { alpha } from '@mui/material';
import { createTheme, type Shadows, type ThemeOptions } from '@mui/material/styles';
import deepmerge from 'deepmerge';

const disable_shadows = [...new Array(25)].map(() => 'none') as Shadows;

type Palette = {
    mode: 'light' | 'dark';
    background: {
        default: string;
        topbar: string;
        grey: string;
        stripe: string;
        stripe_active: string;
        gradient?: string;
    };
    primary: {
        icon?: string;
        main: string;
        contrastText: string;
    };
    secondary: {
        main: string;
        contrastText: string;
    };
    text: {
        primary: string;
        highlight: string;
        secondary: string;
        link: string;
    };
    border: {
        main: string;
    };
    audio?: {
        track: string;
        trackBg: string;
        trackBuffered: string;
        trackBuffering: string;
    };
    searchChip: {
        album: {
            background: string;
            border: string;
            hover: string;
        };
        source: {
            background: string;
            border: string;
            hover: string;
        };
    };
    bottomBar?: Partial<Palette>;
};

function generate_theme(base_palette: Palette) {
    const base_theme: ThemeOptions = {
        typography: {
            fontFamily: '"Poppins", "Roboto", "Helvetica", "Arial", sans-serif',
            fontSize: 12,
            button: {
                textTransform: 'none' as const, // defaults to uppercase in material design
            },
        },
        shadows: disable_shadows,
        mixins: {
            toolbar: {
                height: 44,
                overflowY: 'hidden' as const,
            },
        },
        components: {
            MuiButton: {
                styleOverrides: {
                    root: {
                        '& svg': { marginRight: '0.2rem' },
                    },
                    sizeSmall: {
                        fontSize: '11px',
                        '& svg': {
                            height: 14,
                        },
                    },
                },
            },
            MuiFormControlLabel: {
                styleOverrides: {
                    root: {
                        marginLeft: 0,
                        marginRight: 0,
                    },
                    label: {
                        marginRight: 10,
                    },
                    labelPlacementStart: {
                        marginLeft: 0,
                        marginRight: 0,
                    },
                },
            },
            MuiListItemText: {
                styleOverrides: {
                    primary: {
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    },
                    secondary: {
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    },
                },
            },
            MuiDialog: {
                styleOverrides: {
                    paperFullWidth: {
                        // make fullWidth really full on small screens
                        '@media (max-width: 500px)': {
                            marginLeft: 6,
                            marginRight: 6,
                            width: 'calc(100% - 12px)',
                        },
                    },
                    scrollPaper: {
                        '@media (max-height: 400px)': {
                            // TODO
                            // When virtual keyboard shown allow taller dialogs
                            maxHeight: 'calc(100% - 10px)',
                        },
                    },
                },
            },
            MuiTab: {
                styleOverrides: {
                    root: {
                        flexDirection: 'row',
                        justifyContent: 'start',
                    },
                    labelIcon: { minHeight: 'auto' },
                },
            },
            MuiChip: {
                styleOverrides: {
                    root: {
                        transition: 'background-color 1s, color 1s',
                        margin: 4,
                    },
                },
            },
        },
    };
    const BaseTheme = createTheme(base_theme);

    const theme = deepmerge(base_theme, {
        searchLink: {
            fontWeight: 'normal',
            cursor: 'pointer',
            '@media only print': {
                color: 'black',
            },
        },
        score: {
            highlight: base_palette.primary.main,
            color: base_palette.text.highlight,
        },
        palette: base_palette,
        components: {
            MuiChip: {
                styleOverrides: {
                    root: {
                        backgroundColor: base_palette.background.grey,
                        color: base_palette.text.primary,
                    },
                },
            },
            MuiListItem: {
                styleOverrides: {
                    root: {
                        color: base_palette.text.primary,
                        '&.Mui-selected, &.Mui-selected:hover': {
                            backgroundColor: [base_palette.primary.main, '!important'],
                            color: base_palette.primary.contrastText,
                        },
                    },
                },
            },
        },
    });
    const top_theme = deepmerge(theme, {
        shape: {
            borderRadius: 20,
        },
        shadows: disable_shadows,
        components: {
            MuiButton: {
                styleOverrides: {
                    text: {
                        padding: '6px 16px', // same as contained
                    },
                },
            },
        },
    });
    const bottom_theme = deepmerge.all([
        theme,
        {
            palette: base_palette.bottomBar || {},
            shape: {
                borderRadius: 0,
            },
            shadows: disable_shadows,
            components: {
                MuiButtonGroup: {
                    styleOverrides: {
                        groupedContainedPrimary: { borderRight: 'none !important' },
                    },
                },
            },
        },
    ]);

    const checkbox_padding = 6;
    const isDark = base_palette.mode === 'dark';
    const inverted_bg_default = isDark ? base_palette.background.grey : '#998EF1';
    const inverted_theme = deepmerge(theme, {
        palette: {
            background: {
                gradient: isDark
                    ? `linear-gradient(90deg, ${base_palette.background.topbar}, ${inverted_bg_default})`
                    : 'linear-gradient(90deg, #B68EF3, #918EF0)',
                default: inverted_bg_default,
            },
            primary: {
                //light: '#93DEDC',
                main: '#fff',
                contrastText: isDark ? base_palette.background.grey : '#3D3D3D',
            },
            secondary: {
                main: '#93DEDC',
            },
            text: {
                primary: isDark ? base_palette.text.primary : '#fff',
            },
        },
        components: {
            MuiCheckbox: {
                styleOverrides: {
                    root: {
                        color: theme.palette.background.default,
                        zIndex: 0,
                        padding: checkbox_padding,
                        marginLeft: -checkbox_padding,

                        // Do a white background
                        '& > span:first-child:before': {
                            content: '""',
                            display: 'inline-block',
                            backgroundColor: theme.palette.background.default,
                            position: 'absolute',
                            width: 13, //24 - 4 * 2,
                            height: 13, //24 - 4 * 2,
                            left: checkbox_padding + 4,
                            top: checkbox_padding + 4,
                            pointerEvents: 'none',
                            zIndex: -1,
                        },
                    },
                    checked: {
                        //backgroundColor: '#fff',
                    },
                    indeterminate: {
                        color: '#93DEDC',
                    },
                },
            },
            MuiFormControlLabel: {
                styleOverrides: {
                    root: {
                        alignItems: 'center',
                    },
                    label: {
                        color: theme.palette.primary.contrastText,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                    },
                },
            },
            MuiButtonGroup: {
                styleOverrides: {
                    root: {
                        backgroundColor: theme.palette.background.default,
                        display: 'flex',
                        borderRadius: 16,
                    },
                    groupedOutlined: {
                        border: 'none',
                        '&:hover': { border: 'none' },
                        color: theme.palette.text.link,
                    },
                    groupedText: {
                        color: theme.palette.text.link,
                    },
                },
            },
            MuiButton: {
                styleOverrides: {
                    root: {
                        // Style the same as Input
                        fontFamily: BaseTheme.typography.fontFamily,
                        fontWeight: BaseTheme.typography.body1.fontWeight,
                        fontSize: BaseTheme.typography.pxToRem(16),
                        lineHeight: 'inherit',
                        letterSpacing: 0,
                    },
                },
            },
            MuiNativeSelect: {
                styleOverrides: {
                    select: {
                        paddingTop: 0,
                        paddingBottom: 0,
                        paddingRight: 32,
                        fontSize: BaseTheme.typography.pxToRem(16),
                        lineHeight: 'inherit',
                        minHeight: 0,
                        '&:focus': {
                            backgroundColor: 'transparent',
                        },
                    },
                    icon: {
                        right: 10,
                        color: theme.palette.text.link,
                    },
                },
            },
            MuiInputBase: {
                styleOverrides: {
                    root: {
                        '&.MuiNativeSelect-root': {
                            backgroundColor: theme.palette.background.default,
                            color: theme.palette.text.link,
                            fontSize: BaseTheme.typography.pxToRem(16),
                            lineHeight: 'inherit',
                            borderRadius: 16,
                            paddingTop: 2,
                            paddingBottom: 2,
                            paddingLeft: 16,
                            paddingRight: 0,
                            display: 'flex',
                            alignItems: 'center',
                            '&:before, &:after': {
                                borderBottom: 'none !important',
                            },
                        },
                    },
                },
            },
        },
    });

    return {
        Base: createTheme(theme),
        Top: createTheme(top_theme),
        Bottom: createTheme(bottom_theme),
        Inverted: createTheme(inverted_theme),
    };
}

const base_light_palette: Palette = {
    mode: 'light',
    background: {
        default: '#f8f8f8',
        topbar: '#eee',
        grey: '#ddd',
        stripe: alpha('#C4C4C4', 0.15),
        stripe_active: alpha('#C4C4C4', 0.35),
    },
    primary: {
        icon: '#A88EF2',
        main: '#A88EF2',
        contrastText: '#fff',
    },
    secondary: {
        main: '#A88EF2',
        contrastText: '#fff',
    },
    text: {
        primary: '#7E7E7E',
        highlight: '#333',
        secondary: '#999999',
        link: '#000',
    },
    border: {
        main: '#ccc',
    },
    audio: {
        track: '#D5D5D5',
        trackBg: 'rgba(223, 223, 223, 0.3)',
        trackBuffered: 'rgba(223, 223, 223, 0.3)',
        trackBuffering: 'rgba(200, 200, 200, 1)',
    },
    searchChip: {
        album: {
            background: '#fadbd8',
            border: '#C7A8A5',
            hover: '#E1C2BF',
        },
        source: {
            background: '#d1f2eb',
            border: '#9EBFB8',
            hover: '#B8D9D2',
        },
    },
};

const base_dark_palette = deepmerge(base_light_palette, {
    mode: 'dark',
    background: {
        default: '#323232',
        topbar: '#222',
        grey: '#444',
        stripe: '#444',
        stripe_active: '#555',
    },
    primary: {
        icon: '#BBBBBB',
        main: '#BBBBBB',
        contrastText: '#3D3D3D',
    },
    secondary: {
        main: '#BBBBBB',
        contrastText: '#3D3D3D',
    },
    text: {
        primary: '#bbb',
        secondary: '#999',
        highlight: '#ddd',
        link: '#fff',
    },
    border: {
        main: '#555',
    },
    audio: {
        track: '#666',
        trackBg: 'rgba(100, 100, 100, 0.3)',
        trackBuffered: 'rgba(100, 100, 100, 0.3)',
        trackBuffering: 'rgba(130, 130, 130, 1)',
    },
    searchChip: {
        album: {
            background: '#3B2522',
            border: '#4A302C',
            hover: '#523632',
        },
        source: {
            background: '#253B34',
            border: '#2C4A41',
            hover: '#325247',
        },
    },
    bottomBar: {
        primary: {
            main: '#454545',
            contrastText: '#fff',
        },
    },
});

export const Themes = {
    light: generate_theme(base_light_palette),
    dark: generate_theme(base_dark_palette),
};
