/**
 * 颜色工具函数
 * 用于基于主色生成相关颜色变体
 */

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

/**
 * RGB 转十六进制
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * 调整颜色亮度
 * @param hex 十六进制颜色
 * @param percent 调整百分比（正数变亮，负数变暗）
 */
function adjustBrightness(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const factor = percent / 100;
  const r = Math.min(255, Math.max(0, rgb.r + (255 - rgb.r) * factor));
  const g = Math.min(255, Math.max(0, rgb.g + (255 - rgb.g) * factor));
  const b = Math.min(255, Math.max(0, rgb.b + (255 - rgb.b) * factor));

  return rgbToHex(Math.round(r), Math.round(g), Math.round(b));
}

/**
 * 调整颜色透明度
 * @param hex 十六进制颜色
 * @param alpha 透明度 0-1
 */
function addAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * 基于主色生成主题相关的颜色变量
 * @param primaryColor 主色（十六进制）
 * @param themeMode 主题模式
 */
export function generateThemeColors(primaryColor: string, themeMode: 'light' | 'dark') {
  const rgb = hexToRgb(primaryColor);
  if (!rgb) {
    // 如果颜色解析失败，返回默认值
    return {
      primary: primaryColor,
      primaryLight: themeMode === 'light' ? '#e6f4ff' : '#0b1f3a',
      primaryLighter: themeMode === 'light' ? '#bae0ff' : '#102a44',
      primaryDark: themeMode === 'light' ? '#1d39c4' : '#e6f4ff',
      primaryDarker: themeMode === 'light' ? '#10239e' : '#e6f4ff',
      primaryAlpha10: addAlpha(primaryColor, 0.1),
      primaryAlpha20: addAlpha(primaryColor, 0.2),
      primaryAlpha30: addAlpha(primaryColor, 0.3),
    };
  }

  if (themeMode === 'light') {
    // 浅色主题：侧边栏使用浅色变体
    return {
      primary: primaryColor,
      primaryLight: adjustBrightness(primaryColor, 85), // 非常浅的背景
      primaryLighter: adjustBrightness(primaryColor, 70), // 选中背景
      primaryDark: adjustBrightness(primaryColor, -40), // 文字颜色
      primaryDarker: adjustBrightness(primaryColor, -50), // 选中文字
      primaryAlpha10: addAlpha(primaryColor, 0.1),
      primaryAlpha20: addAlpha(primaryColor, 0.2),
      primaryAlpha30: addAlpha(primaryColor, 0.3),
    };
  } else {
    // 暗色主题：侧边栏使用深色变体
    return {
      primary: primaryColor,
      primaryLight: adjustBrightness(primaryColor, -70), // 深色背景
      primaryLighter: adjustBrightness(primaryColor, -60), // 选中背景
      primaryDark: 'rgba(255, 255, 255, 0.85)', // 文字颜色
      primaryDarker: adjustBrightness(primaryColor, 50), // 选中文字（使用主色的浅色变体）
      primaryAlpha10: addAlpha(primaryColor, 0.1),
      primaryAlpha20: addAlpha(primaryColor, 0.2),
      primaryAlpha30: addAlpha(primaryColor, 0.3),
    };
  }
}

/**
 * 设置 CSS 变量到 document root
 */
export function setThemeCSSVariables(primaryColor: string, themeMode: 'light' | 'dark') {
  if (typeof document === 'undefined') return;

  const colors = generateThemeColors(primaryColor, themeMode);
  const root = document.documentElement;

  // 设置主色相关变量
  root.style.setProperty('--primary-color', colors.primary);
  root.style.setProperty('--sider-bg', colors.primaryLight);
  root.style.setProperty('--sider-fg', colors.primaryDark);
  root.style.setProperty('--sider-selected-bg', colors.primaryLighter);
  root.style.setProperty('--sider-selected-fg', colors.primaryDarker);
  root.style.setProperty('--primary-alpha-10', colors.primaryAlpha10);
  root.style.setProperty('--primary-alpha-20', colors.primaryAlpha20);
  root.style.setProperty('--primary-alpha-30', colors.primaryAlpha30);
}

