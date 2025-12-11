import React from 'react';
import { Card, Skeleton } from 'antd';

interface StatisticCardSkeletonProps {
  /** 是否显示标题 */
  showTitle?: boolean;
  /** 标题宽度 */
  titleWidth?: string | number;
}

/**
 * 统计卡片骨架屏
 * 用于Statistic组件的加载状态
 */
const StatisticCardSkeleton: React.FC<StatisticCardSkeletonProps> = ({
  showTitle = true,
  titleWidth = '60%',
}) => {
  return (
    <Card>
      {showTitle && (
        <Skeleton 
          active 
          paragraph={{ rows: 0 }}
          title={{ width: titleWidth }}
        />
      )}
      <Skeleton.Input 
        active 
        size="large" 
        style={{ 
          width: '80%', 
          marginTop: showTitle ? 8 : 0, 
          height: 32 
        }} 
      />
    </Card>
  );
};

export default StatisticCardSkeleton;

