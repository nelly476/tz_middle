import { create } from 'zustand';

interface AuthState {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: !!sessionStorage.getItem('access_token'),
  login: () => set({ isAuthenticated: true }),
  logout: () => {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    set({ isAuthenticated: false });
  },
}));