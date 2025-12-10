import { useEffect } from 'react';
import logo1 from '@/assets/logo1.jpg';
import logo2 from '@/assets/logo2.jpg';

/**
 * 预加载关键资源组件
 * 用于优化 LCP (Largest Contentful Paint) 指标
 * 
 * 功能：
 * 1. 在 HTML head 中添加 <link rel="preload"> 链接
 * 2. 让浏览器尽早发现并加载 LCP 图像
 * 3. 使用 fetchPriority="high" 提高优先级
 */
const PreloadResources: React.FC = () => {
  useEffect(() => {
    // 预加载 LCP 图像（logo）
    // 使用 link rel="preload" 让浏览器尽早发现并加载图片
    
    // 检查是否已经添加过预加载链接
    const existingPreloads = document.querySelectorAll('link[rel="preload"][as="image"][data-lcp="true"]');
    if (existingPreloads.length > 0) {
      return; // 已经添加过，不需要重复添加
    }

    // 预加载两个 logo（因为可能使用任何一个）
    // 默认优先预加载 logo2（展开状态，更大，更可能是 LCP）
    const logosToPreload = [
      { src: logo2, priority: 'high' }, // 主要 LCP 候选
      { src: logo1, priority: 'low' }   // 备用
    ];

    const addedLinks: HTMLLinkElement[] = [];

    logosToPreload.forEach(({ src, priority }) => {
      // 创建预加载链接
      const preloadLink = document.createElement('link');
      preloadLink.rel = 'preload';
      preloadLink.as = 'image';
      preloadLink.href = src;
      preloadLink.setAttribute('fetchPriority', priority);
      preloadLink.setAttribute('data-lcp', 'true'); // 标记为 LCP 资源
      
      // 添加到 head（在现有样式表之后，但在脚本之前）
      const firstScript = document.querySelector('script');
      if (firstScript) {
        document.head.insertBefore(preloadLink, firstScript);
      } else {
        document.head.appendChild(preloadLink);
      }
      
      addedLinks.push(preloadLink);
    });

    // 清理函数（组件卸载时移除预加载链接）
    return () => {
      addedLinks.forEach(link => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      });
    };
  }, []);

  return null; // 此组件不渲染任何内容
};

export default PreloadResources;

