// MUI Theme augmentation for custom properties
import '@mui/material/styles';

declare module '@mui/material/styles' {
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
}
