import { create } from 'zustand';

interface CanPrint {
    canPrint: boolean;
    set: (newState: boolean) => void;
}

export const useCanPrint = create<CanPrint>((set) => ({
    canPrint: true,
    set: (canPrint) => set({ canPrint }),
}));
