import React from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

interface ChartLoadingProps {
  /** 提示文字 */
  tip?: string;
  /** 最小高度 */
  minHeight?: number | string;
}

/**
 * 图表加载组件
 * 专门用于图表组件的懒加载fallback
 */
const ChartLoading: React.FC<ChartLoadingProps> = ({ 
  tip = '图表加载中...',
  minHeight = 300 
}) => {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight,
      width: '100%'
    }}>
      <Spin 
        size="large" 
        indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />}
      />
      {tip && (
        <div style={{ marginTop: 12, color: 'rgba(0, 0, 0, 0.45)', fontSize: 14 }}>
          {tip}
        </div>
      )}
    </div>
  );
};

export default ChartLoading;

