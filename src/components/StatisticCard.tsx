import React, { memo } from 'react';
import { Card, Statistic, Space, Badge } from 'antd';
import type { StatisticProps } from 'antd';

interface StatisticCardProps {
  title: string | React.ReactNode;
  value: number | string;
  suffix?: string;
  prefix?: React.ReactNode;
  icon?: React.ReactNode;
  loading?: boolean;
  precision?: number;
  valueStyle?: React.CSSProperties;
  badge?: {
    count: number | string;
    style?: React.CSSProperties;
  };
}

/**
 * 优化的统计卡片组件
 * 使用 React.memo 避免不必要的重渲染
 */
const StatisticCard: React.FC<StatisticCardProps> = memo(({
  title,
  value,
  suffix,
  prefix,
  icon,
  loading,
  precision,
  valueStyle,
  badge,
}) => {
  const titleNode = typeof title === 'string' ? (
    <Space>
      {icon}
      <span>{title}</span>
      {badge && <Badge count={badge.count} style={badge.style} />}
    </Space>
  ) : (
    title
  );

  return (
    <Card>
      <Statistic
        title={titleNode}
        value={value}
        suffix={suffix}
        prefix={prefix}
        loading={loading}
        precision={precision}
        valueStyle={valueStyle}
      />
    </Card>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数，只有关键属性变化时才重渲染
  return (
    prevProps.value === nextProps.value &&
    prevProps.title === nextProps.title &&
    prevProps.loading === nextProps.loading &&
    prevProps.suffix === nextProps.suffix &&
    prevProps.precision === nextProps.precision &&
    JSON.stringify(prevProps.valueStyle) === JSON.stringify(nextProps.valueStyle) &&
    JSON.stringify(prevProps.badge) === JSON.stringify(nextProps.badge)
  );
});

StatisticCard.displayName = 'StatisticCard';

export default StatisticCard;

