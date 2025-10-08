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
  setUserInfo: (userInfo: UserInfo | null) => void
  themeMode: 'light' | 'dark'
  setThemeMode: (mode: 'light' | 'dark') => void
  siteSettings: {
    siteName: string
    organizationName: string
    logoUrl: string
    primaryColor: string
    componentSize: 'small' | 'middle' | 'large'
  }
  setSiteSettings: (settings: Partial<GlobalState['siteSettings']>) => void
  selectedProjectId: string
  setSelectedProjectId: (projectId: string) => void
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

// 从localStorage获取初始项目ID
const getInitialProjectId = (): string => {
  const storedProjectId = localStorage.getItem('selectedProjectId');
  return storedProjectId || 'demo-project';
};

const getInitialSiteSettings = () => {
  const raw = localStorage.getItem('siteSettings');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return {
        siteName: parsed.siteName ?? '埋点分析平台',
        organizationName: parsed.organizationName ?? 'Demo Org',
        logoUrl: parsed.logoUrl ?? '',
        primaryColor: parsed.primaryColor ?? '#1677ff',
        componentSize: parsed.componentSize ?? 'middle'
      } as GlobalState['siteSettings'];
    } catch {
      // fallthrough to default
    }
  }
  return {
    siteName: '埋点分析平台',
    organizationName: 'Demo Org',
    logoUrl: '',
    primaryColor: '#1677ff',
    componentSize: 'middle'
  } as GlobalState['siteSettings'];
};

const useGlobalStore = create<GlobalState>(set => ({
  userInfo: getInitialUserInfo(),
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
  },
  siteSettings: getInitialSiteSettings(),
  setSiteSettings: (settings) => {
    set(state => {
      const next = { ...state.siteSettings, ...settings };
      localStorage.setItem('siteSettings', JSON.stringify(next));
      return { siteSettings: next } as Partial<GlobalState>;
    });
  },
  selectedProjectId: getInitialProjectId(),
  setSelectedProjectId: (projectId) => {
    localStorage.setItem('selectedProjectId', projectId);
    set({ selectedProjectId: projectId });
  }
}))
export default useGlobalStore
