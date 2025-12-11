import React from 'react';
import { Card, Skeleton, Table } from 'antd';

interface TableSkeletonProps {
  /** 表格列数 */
  columns?: number;
  /** 表格行数 */
  rows?: number;
  /** 是否显示卡片 */
  showCard?: boolean;
  /** 卡片标题 */
  cardTitle?: string;
}

/**
 * 表格骨架屏
 * 用于Table组件的加载状态
 */
const TableSkeleton: React.FC<TableSkeletonProps> = ({
  columns = 3,
  rows = 5,
  showCard = true,
  cardTitle,
}) => {
  const skeletonContent = (
    <>
      {cardTitle && (
        <Skeleton 
          active 
          title={{ width: '30%' }}
          paragraph={{ rows: 0 }}
          style={{ marginBottom: 16 }}
        />
      )}
      <Skeleton 
        active 
        paragraph={{ rows }}
      />
    </>
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

export default TableSkeleton;

