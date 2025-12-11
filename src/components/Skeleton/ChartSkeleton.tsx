import React from 'react';
import { Card, Skeleton } from 'antd';

interface ChartSkeletonProps {
  /** 是否显示卡片 */
  showCard?: boolean;
  /** 卡片标题 */
  cardTitle?: string;
  /** 图表高度 */
  height?: number | string;
}

/**
 * 图表骨架屏
 * 用于图表组件的加载状态
 */
const ChartSkeleton: React.FC<ChartSkeletonProps> = ({
  showCard = true,
  cardTitle,
  height = 400,
}) => {
  const skeletonContent = (
    <div style={{ 
      height: typeof height === 'number' ? `${height}px` : height,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }}>
      <Skeleton 
        active 
        title={{ width: cardTitle ? '30%' : 0 }}
        paragraph={{ rows: 8 }}
      />
    </div>
  );

  if (showCard) {
    return (
      <Card title={cardTitle}>
        {skeletonContent}
      </Card>
    );
  }

  return skeletonContent;
};

export default ChartSkeleton;

