import { create } from 'zustand'

interface UserInfo {
  id: string;
  username: string;
  email: string;
  created_at: string;
  updated_at: string;
}

interface GlobalState {
  userInfo: UserInfo | null;
  trackingConfig: { projectId: string }
  setUserInfo: (userInfo: UserInfo | null) => void
}

// 从localStorage获取初始用户信息
const getInitialUserInfo = (): UserInfo | null => {
  const storedUserInfo = localStorage.getItem('userInfo');
  return storedUserInfo ? JSON.parse(storedUserInfo) : null;
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
  }
}))
export default useGlobalStore
