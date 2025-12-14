import React, { useState, useEffect, useRef } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
  loading?: 'lazy' | 'eager';
  fallback?: string;
  fetchPriority?: 'high' | 'low' | 'auto';
  isLCP?: boolean; // 标记是否为 LCP 图像
}

// 检查浏览器是否支持 WebP（缓存结果）
// 注意：当前已禁用 WebP 自动转换功能，因为项目中可能没有对应的 .webp 文件
// 如果需要启用，请取消下面的注释并确保对应的 .webp 文件存在
// let webpSupported: boolean | null = null;
// 
// const checkWebPSupport = (): boolean => {
//   if (webpSupported !== null) {
//     return webpSupported;
//   }
//   
//   try {
//     const canvas = document.createElement('canvas');
//     canvas.width = 1;
//     canvas.height = 1;
//     webpSupported = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
//   } catch {
//     webpSupported = false;
//   }
//   
//   return webpSupported;
// };

/**
 * 优化的图片组件
 * - 支持 WebP 格式（如果可用）
 * - 延迟加载（lazy loading）
 * - 固定尺寸避免布局偏移
 * - 错误回退处理
 */
const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  className,
  style,
  loading = 'lazy',
  fallback,
  fetchPriority,
  isLCP = false
}) => {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  // 尝试转换为 WebP 格式（如果浏览器支持）
  // 注意：当前已禁用 WebP 自动转换功能
  // 如果需要启用，请取消下面的注释
  // const getWebPSrc = (originalSrc: string): string => {
  //   // 如果是外部 URL 或 base64，直接返回
  //   if (originalSrc.startsWith('http://') || 
  //       originalSrc.startsWith('https://') || 
  //       originalSrc.startsWith('data:')) {
  //     return originalSrc;
  //   }
  //   
  //   // 如果是本地资源，尝试使用 WebP 版本
  //   // 注意：这需要你手动创建 WebP 版本的图片
  //   const webpSrc = originalSrc.replace(/\.(png|jpg|jpeg)$/i, '.webp');
  //   return webpSrc;
  // };

  useEffect(() => {
    // 重置错误状态当 src 改变时
    setHasError(false);
    
    // 由于项目中可能没有 WebP 版本，直接使用原始图片
    // 如果需要使用 WebP，请确保对应的 .webp 文件存在
    setImgSrc(src);
    
    // 如果将来需要支持 WebP，可以取消下面的注释：
    // // 检查是否支持 WebP，如果支持则尝试使用 WebP 版本
    // if (checkWebPSupport()) {
    //   const webpSrc = getWebPSrc(src);
    //   // 如果 WebP 版本存在（通过尝试加载检测），使用它
    //   // 这里简化处理，直接尝试 WebP，失败时回退到原始图片
    //   setImgSrc(webpSrc);
    // } else {
    //   setImgSrc(src);
    // }
  }, [src]);

  const handleError = () => {
    // 如果 WebP 加载失败，回退到原始格式
    if (imgSrc !== src && !hasError) {
      setImgSrc(src);
      setHasError(true);
    } else if (fallback && imgSrc !== fallback) {
      setImgSrc(fallback);
      setHasError(true);
    }
  };

  // 确定 fetchPriority
  // LCP 图像或明确设置为 eager 的图片使用 high
  // 否则根据 loading 属性决定
  const finalFetchPriority = fetchPriority || (isLCP || loading === 'eager' ? 'high' : 'low');
  
  // LCP 图像应该使用同步解码，避免延迟
  const decoding = isLCP ? 'sync' : 'async';

  // 使用 ref 来设置 fetchpriority 属性（React 要求小写）
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imgRef.current && finalFetchPriority) {
      // 使用小写的 fetchpriority，这是 DOM 标准属性名
      imgRef.current.setAttribute('fetchpriority', finalFetchPriority);
    }
  }, [finalFetchPriority]);

  return (
    <img
      ref={imgRef}
      src={imgSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
      loading={loading}
      onError={handleError}
      decoding={decoding}
    />
  );
};

export default OptimizedImage;

