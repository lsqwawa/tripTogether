import { create } from "zustand";
import { userApi } from "../api";
import type { User } from "../types";

interface UserState {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  register: (nickname: string, password: string) => Promise<User>;
  login: (nickname: string, password?: string) => Promise<User>;
  updateProfile: (data: { nickname?: string; avatar?: string }) => Promise<User>;
  logout: () => void;
  init: () => Promise<void>;
}

const TOKEN_KEY = "authToken";
const USER_KEY = "userInfo";

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  loading: false,

  setUser: (user) => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
    set({ user });
  },

  register: async (nickname: string, password: string) => {
    set({ loading: true });
    try {
      const { user, token } = await userApi.register(nickname, password);
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      set({ user, loading: false });
      return user;
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  login: async (nickname: string, password?: string) => {
    set({ loading: true });
    try {
      const { user, token } = await userApi.login(nickname, password);
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      set({ user, loading: false });
      return user;
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  updateProfile: async (data) => {
    const user = await userApi.updateMe(data);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user });
    return user;
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ user: null });
  },

  init: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    const storedUserInfo = localStorage.getItem(USER_KEY);

    if (token && storedUserInfo) {
      try {
        const user = JSON.parse(storedUserInfo) as User;
        set({ user });
        // 后台刷新，校验 token 是否仍有效
        userApi
          .me()
          .then((fresh) => {
            localStorage.setItem(USER_KEY, JSON.stringify(fresh));
            set({ user: fresh });
          })
          .catch(() => {});
        return;
      } catch {
        // ignore
      }
    }

    if (token) {
      try {
        const user = await userApi.me();
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        set({ user });
      } catch {
        // token 失效，清理会话
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
  },
}));
