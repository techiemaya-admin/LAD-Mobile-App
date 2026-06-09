import { create } from 'zustand';

type OverlayState = {
  isCallDialerOpen: boolean;
  setCallDialerOpen: (isOpen: boolean) => void;
};

export const useOverlayStore = create<OverlayState>((set) => ({
  isCallDialerOpen: false,
  setCallDialerOpen: (isOpen) => set({ isCallDialerOpen: isOpen }),
}));
