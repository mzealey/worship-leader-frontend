import { CssBaseline, ThemeProvider } from '@mui/material';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { match_media_watcher } from '../globals';
import { createContext, useContext } from '../preact-helpers';
import { useSetting } from '../settings-store';
import { Themes } from '../themes';

const AppTheme = createContext(Themes.light);

type ThemeSection = keyof typeof Themes.light;
type ThemeName = keyof typeof Themes;

interface ThemeProps {
    children?: ReactNode;
    section?: ThemeSection;
}

export const Theme = ({ children, section }: ThemeProps) => {
    const baseTheme = useContext(AppTheme);

    return section ? <ThemeProvider theme={baseTheme[section]}>{children}</ThemeProvider> : <>{children}</>;
};

interface ThemeAppProps {
    children?: ReactNode;
}

export const ThemeApp = ({ children }: ThemeAppProps) => {
    const [setting_theme] = useSetting('theme');
    const [inited, setInited] = useState(false);
    const [preferDark, setPreferDark] = useState(false);

    useEffect(() => {
        const watcher = match_media_watcher('(prefers-color-scheme: dark)', (mql) => setPreferDark(mql.matches));
        setInited(true);

        return () => watcher?.unsubscribe?.();
    }, []);

    const themeName: ThemeName = useMemo(() => {
        if (setting_theme === 'dark' || setting_theme === 'light') return setting_theme;
        return preferDark ? 'dark' : 'light';
    }, [preferDark, setting_theme]);

    if (!inited) {
        return null;
    }

    return (
        <AppTheme.Provider value={Themes[themeName]}>
            <Theme section="Base">
                <CssBaseline />
                {children}
            </Theme>
        </AppTheme.Provider>
    );
};
