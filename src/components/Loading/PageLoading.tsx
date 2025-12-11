import React from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

interface PageLoadingProps {
  /** 提示文字 */
  tip?: string;
  /** 是否全屏显示 */
  fullScreen?: boolean;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/**
 * 页面加载组件
 * 用于路由懒加载时的fallback
 */
const PageLoading: React.FC<PageLoadingProps> = ({ 
  tip = '页面加载中...', 
  fullScreen = false,
  style 
}) => {
  const defaultStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: fullScreen ? '100vh' : '400px',
    width: '100%',
    ...style,
  };

  return (
    <div style={defaultStyle}>
      <Spin 
        size="large"
        indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} 
        tip={tip}
      />
    </div>
  );
};

export default PageLoading;

