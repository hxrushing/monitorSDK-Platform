import { create } from 'zustand'

interface UserInfo {
  id: string;
  username: string;
  email: string;
  role: 'Admin' | 'User';
  created_at: string;
  updated_at: string;
}

interface GlobalState {
  userInfo: UserInfo | null;
  trackingConfig: { projectId: string }
  setUserInfo: (userInfo: UserInfo | null) => void
  themeMode: 'light' | 'dark'
  setThemeMode: (mode: 'light' | 'dark') => void
}

// 从localStorage获取初始用户信息
const getInitialUserInfo = (): UserInfo | null => {
  const storedUserInfo = localStorage.getItem('userInfo');
  return storedUserInfo ? JSON.parse(storedUserInfo) : null;
};

// 从localStorage获取初始主题
const getInitialThemeMode = (): 'light' | 'dark' => {
  const storedTheme = localStorage.getItem('themeMode');
  return storedTheme === 'dark' ? 'dark' : 'light';
};

const useGlobalStore = create<GlobalState>(set => ({
  userInfo: getInitialUserInfo(),
  trackingConfig: { projectId: 'default-project' },
  setUserInfo: (userInfo) => {
    if (userInfo) {
      localStorage.setItem('userInfo', JSON.stringify(userInfo));
    } else {
      localStorage.removeItem('userInfo');
    }
    set({ userInfo });
  },
  themeMode: getInitialThemeMode(),
  setThemeMode: (mode) => {
    localStorage.setItem('themeMode', mode);
    set({ themeMode: mode });
  }
}))
export default useGlobalStore
