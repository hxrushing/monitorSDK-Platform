/**
 * 主题预设方案
 * 提供多种均衡美观的主题配色方案
 */

export interface ThemePreset {
  name: string;
  displayName: string;
  description: string;
  colors: {
    primary: string;
    light: {
      siderBg: string;
      siderFg: string;
      siderSelectedBg: string;
      siderSelectedFg: string;
      appBg: string;
      appText: string;
    };
    dark: {
      siderBg: string;
      siderFg: string;
      siderSelectedBg: string;
      siderSelectedFg: string;
      appBg: string;
      appText: string;
    };
  };
}

export const themePresets: Record<string, ThemePreset> = {
  'default-blue': {
    name: 'default-blue',
    displayName: '经典蓝',
    description: 'Ant Design 默认蓝色，专业稳重',
    colors: {
      primary: '#1677ff',
      light: {
        siderBg: '#e6f4ff',
        siderFg: '#1d39c4',
        siderSelectedBg: '#bae0ff',
        siderSelectedFg: '#10239e',
        appBg: '#f5f5f5',
        appText: 'rgba(0, 0, 0, 0.88)',
      },
      dark: {
        siderBg: '#0b1f3a',
        siderFg: 'rgba(255, 255, 255, 0.85)',
        siderSelectedBg: '#102a44',
        siderSelectedFg: '#e6f4ff',
        appBg: '#141414',
        appText: 'rgba(255, 255, 255, 0.85)',
      },
    },
  },
  'tiffany-green': {
    name: 'tiffany-green',
    displayName: '蒂芙尼绿',
    description: '优雅清新的蒂芙尼绿，时尚经典',
    colors: {
      primary: '#0abab5',
      light: {
        siderBg: '#e0f7f6',
        siderFg: '#006b68',
        siderSelectedBg: '#b3ebe8',
        siderSelectedFg: '#004d4a',
        appBg: '#f5f5f5',
        appText: 'rgba(0, 0, 0, 0.88)',
      },
      dark: {
        siderBg: '#0a2e2c',
        siderFg: '#7fdeda',
        siderSelectedBg: '#0f3d3a',
        siderSelectedFg: '#0abab5',
        appBg: '#141414',
        appText: 'rgba(255, 255, 255, 0.85)',
      },
    },
  },
  'coral-pink': {
    name: 'coral-pink',
    displayName: '珊瑚粉',
    description: '温暖活力的珊瑚粉，充满活力',
    colors: {
      primary: '#ff7f7f',
      light: {
        siderBg: '#fff0f0',
        siderFg: '#cc3333',
        siderSelectedBg: '#ffe0e0',
        siderSelectedFg: '#990000',
        appBg: '#f5f5f5',
        appText: 'rgba(0, 0, 0, 0.88)',
      },
      dark: {
        siderBg: '#2e1a1a',
        siderFg: '#ffb3b3',
        siderSelectedBg: '#3d2424',
        siderSelectedFg: '#ff7f7f',
        appBg: '#141414',
        appText: 'rgba(255, 255, 255, 0.85)',
      },
    },
  },
  'lavender-purple': {
    name: 'lavender-purple',
    displayName: '薰衣草紫',
    description: '浪漫优雅的薰衣草紫，温柔舒适',
    colors: {
      primary: '#b19cd9',
      light: {
        siderBg: '#f3eff9',
        siderFg: '#6b4c93',
        siderSelectedBg: '#e6d9f2',
        siderSelectedFg: '#4a2c6b',
        appBg: '#f5f5f5',
        appText: 'rgba(0, 0, 0, 0.88)',
      },
      dark: {
        siderBg: '#2a1f3a',
        siderFg: '#d4c4e8',
        siderSelectedBg: '#35244d',
        siderSelectedFg: '#b19cd9',
        appBg: '#141414',
        appText: 'rgba(255, 255, 255, 0.85)',
      },
    },
  },
  'amber-orange': {
    name: 'amber-orange',
    displayName: '琥珀橙',
    description: '温暖明亮的琥珀橙，充满能量',
    colors: {
      primary: '#ff9800',
      light: {
        siderBg: '#fff4e6',
        siderFg: '#cc6600',
        siderSelectedBg: '#ffe0b3',
        siderSelectedFg: '#994d00',
        appBg: '#f5f5f5',
        appText: 'rgba(0, 0, 0, 0.88)',
      },
      dark: {
        siderBg: '#2e1f0a',
        siderFg: '#ffcc80',
        siderSelectedBg: '#3d2a14',
        siderSelectedFg: '#ff9800',
        appBg: '#141414',
        appText: 'rgba(255, 255, 255, 0.85)',
      },
    },
  },
  'emerald-green': {
    name: 'emerald-green',
    displayName: '翡翠绿',
    description: '清新自然的翡翠绿，生机勃勃',
    colors: {
      primary: '#10b981',
      light: {
        siderBg: '#d1fae5',
        siderFg: '#047857',
        siderSelectedBg: '#a7f3d0',
        siderSelectedFg: '#065f46',
        appBg: '#f5f5f5',
        appText: 'rgba(0, 0, 0, 0.88)',
      },
      dark: {
        siderBg: '#0a2e1f',
        siderFg: '#6ee7b7',
        siderSelectedBg: '#0f3d2a',
        siderSelectedFg: '#10b981',
        appBg: '#141414',
        appText: 'rgba(255, 255, 255, 0.85)',
      },
    },
  },
  'rose-red': {
    name: 'rose-red',
    displayName: '玫瑰红',
    description: '优雅浪漫的玫瑰红，精致典雅',
    colors: {
      primary: '#e91e63',
      light: {
        siderBg: '#fce4ec',
        siderFg: '#ad1457',
        siderSelectedBg: '#f8bbd0',
        siderSelectedFg: '#880e4f',
        appBg: '#f5f5f5',
        appText: 'rgba(0, 0, 0, 0.88)',
      },
      dark: {
        siderBg: '#2e0f1a',
        siderFg: '#f48fb1',
        siderSelectedBg: '#3d1a2a',
        siderSelectedFg: '#e91e63',
        appBg: '#141414',
        appText: 'rgba(255, 255, 255, 0.85)',
      },
    },
  },
  'ocean-blue': {
    name: 'ocean-blue',
    displayName: '海洋蓝',
    description: '深邃宁静的海洋蓝，沉稳专业',
    colors: {
      primary: '#0288d1',
      light: {
        siderBg: '#e1f5fe',
        siderFg: '#01579b',
        siderSelectedBg: '#b3e5fc',
        siderSelectedFg: '#014377',
        appBg: '#f5f5f5',
        appText: 'rgba(0, 0, 0, 0.88)',
      },
      dark: {
        siderBg: '#0a1f2e',
        siderFg: '#81d4fa',
        siderSelectedBg: '#0f2a3d',
        siderSelectedFg: '#0288d1',
        appBg: '#141414',
        appText: 'rgba(255, 255, 255, 0.85)',
      },
    },
  },
};

/**
 * 获取预设主题
 */
export function getThemePreset(name: string): ThemePreset {
  return themePresets[name] || themePresets['default-blue'];
}

/**
 * 获取所有预设主题列表
 */
export function getThemePresetList(): Array<{ label: string; value: string; description: string }> {
  return Object.values(themePresets).map(preset => ({
    label: preset.displayName,
    value: preset.name,
    description: preset.description,
  }));
}

/**
 * 应用预设主题到 CSS 变量
 */
export function applyThemePreset(presetName: string, themeMode: 'light' | 'dark') {
  if (typeof document === 'undefined') return;

  const preset = getThemePreset(presetName);
  const colors = themeMode === 'light' ? preset.colors.light : preset.colors.dark;
  const root = document.documentElement;

  // 设置主色
  root.style.setProperty('--primary-color', preset.colors.primary);
  
  // 设置侧边栏颜色
  root.style.setProperty('--sider-bg', colors.siderBg);
  root.style.setProperty('--sider-fg', colors.siderFg);
  root.style.setProperty('--sider-selected-bg', colors.siderSelectedBg);
  root.style.setProperty('--sider-selected-fg', colors.siderSelectedFg);
  
  // 设置应用背景和文字颜色
  root.style.setProperty('--app-bg', colors.appBg);
  root.style.setProperty('--app-text', colors.appText);
  
  // 设置透明度变体
  const rgb = hexToRgb(preset.colors.primary);
  if (rgb) {
    root.style.setProperty('--primary-alpha-10', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`);
    root.style.setProperty('--primary-alpha-20', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`);
    root.style.setProperty('--primary-alpha-30', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`);
  }
}

/**
 * 将十六进制颜色转换为 RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

