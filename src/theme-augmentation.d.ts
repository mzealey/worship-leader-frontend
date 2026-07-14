// MUI Theme augmentation for custom properties
import '@mui/material/styles';

declare module '@mui/material/styles' {
    interface Theme {
        searchLink: {
            fontWeight: string;
            cursor: string;
            '@media only print': {
                color: string;
            };
        };
        score: {
            highlight: string;
            color: string;
        };
    }

    interface ThemeOptions {
        searchLink?: {
            fontWeight?: string;
            cursor?: string;
            '@media only print'?: {
                color?: string;
            };
        };
        score?: {
            highlight?: string;
            color?: string;
        };
    }

    interface Palette {
        border: {
            main: string;
        };
        audio: {
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
    }

    interface PaletteOptions {
        border?: {
            main?: string;
        };
        audio?: {
            track?: string;
            trackBg?: string;
            trackBuffered?: string;
            trackBuffering?: string;
        };
        searchChip?: {
            album?: {
                background?: string;
                border?: string;
                hover?: string;
            };
            source?: {
                background?: string;
                border?: string;
                hover?: string;
            };
        };
    }

    interface TypeBackground {
        topbar?: string;
        grey?: string;
        stripe?: string;
        stripe_active?: string;
        gradient?: string;
    }

    interface TypeText {
        highlight?: string;
        link?: string;
    }

    interface PaletteColor {
        icon?: string;
    }

    interface SimplePaletteColorOptions {
        icon?: string;
    }
}
