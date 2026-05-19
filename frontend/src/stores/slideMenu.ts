import { create } from 'zustand';

interface SlideMenuState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const useSlideMenu = create<SlideMenuState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));
