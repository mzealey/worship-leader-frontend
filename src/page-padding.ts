import { create } from 'zustand';

interface PagePadding {
    top: number;
    bottom: number;
    left: number;
    right: number;
    set: (newState: Partial<PagePadding>) => void;
    reset: (newState?: Partial<PagePadding>) => void;
}

export const usePagePadding = create<PagePadding>((set) => ({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    set,
    reset: (newState) => set({ top: 0, bottom: 0, left: 0, right: 0, ...newState }),
}));
