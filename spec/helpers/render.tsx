import { createTheme, ThemeProvider } from '@mui/material';
import type { RenderOptions } from '@testing-library/react';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { Themes } from '../../src/themes';

const defaultTheme = createTheme(Themes.light.Base);

function MinimalProvider({ children }: { children: ReactNode }) {
    return <ThemeProvider theme={defaultTheme}>{children}</ThemeProvider>;
}

export function renderWithProviders(ui: ReactNode, options?: Omit<RenderOptions, 'wrapper'>) {
    return render(ui, { wrapper: MinimalProvider, ...options });
}

export function renderWithRouter(ui: ReactNode, initialEntries?: string[]) {
    return renderWithProviders(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}
