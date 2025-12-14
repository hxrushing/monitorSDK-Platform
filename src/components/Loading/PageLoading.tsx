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
      <div style={{ textAlign: 'center' }}>
        <Spin 
          size="large"
          indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />}
        />
        {tip && (
          <div style={{ marginTop: 16, color: 'rgba(0, 0, 0, 0.45)' }}>
            {tip}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageLoading;

