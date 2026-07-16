import { createTheme, ThemeProvider } from '@mui/material';
import type { RenderOptions } from '@testing-library/react';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createContext } from 'react';
import { MemoryRouter } from 'react-router';
import { MemoryRouter as MemoryRouterDom } from 'react-router-dom';
import { Themes } from '../../src/themes';

const AppTheme = createContext(Themes.light);

interface WrapperProps {
    children: ReactNode;
    themeSection?: keyof typeof Themes.light;
}

function AllTheProviders({ children, themeSection = 'Base' }: WrapperProps) {
    const baseTheme = Themes.light;
    const theme = baseTheme[themeSection];

    return (
        <AppTheme.Provider value={baseTheme}>
            <ThemeProvider theme={theme}>{children}</ThemeProvider>
        </AppTheme.Provider>
    );
}

const defaultTheme = createTheme(Themes.light.Base);

function MinimalProvider({ children }: { children: ReactNode }) {
    return <ThemeProvider theme={defaultTheme}>{children}</ThemeProvider>;
}

export function renderWithProviders(ui: ReactNode, options?: Omit<RenderOptions, 'wrapper'>) {
    return render(ui, { wrapper: MinimalProvider, ...options });
}

export function renderWithAppTheme(ui: ReactNode, themeSection?: keyof typeof Themes.light, options?: Omit<RenderOptions, 'wrapper'>) {
    const ThemeWrapper = ({ children }: { children: ReactNode }) => <AllTheProviders themeSection={themeSection}>{children}</AllTheProviders>;
    return render(ui, { wrapper: ThemeWrapper, ...options });
}

export function renderWithRouter(ui: ReactNode, initialEntries?: string[]) {
    return renderWithProviders(
        <MemoryRouter initialEntries={initialEntries}>
            <MemoryRouterDom>{ui}</MemoryRouterDom>
        </MemoryRouter>,
    );
}
