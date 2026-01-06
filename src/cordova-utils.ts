import { is_cordova, UnknownArgs } from './util';

type StatusBarFn = (...args: UnknownArgs) => void;

// Wrapper in case we don't have cordova
export function statusbar(fn: string): void {
    const statusBar = (window as unknown as { StatusBar?: Record<string, StatusBarFn> }).StatusBar;
    if (is_cordova() && statusBar && typeof statusBar[fn] === 'function') statusBar[fn]!();
}
