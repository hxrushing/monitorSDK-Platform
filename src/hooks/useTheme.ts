import { theme } from 'antd';

export function useTheme() {
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  return {
    colorBgContainer,
  };
} 