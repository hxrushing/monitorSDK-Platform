import React from 'react';
import { Card, Row, Col, Skeleton } from 'antd';

/**
 * Dashboard页面骨架屏
 * 用于数据加载时显示，提升用户体验
 */
const DashboardSkeleton: React.FC = () => {
  return (
    <div>
      {/* 顶部工具栏骨架 */}
      <div style={{ marginBottom: 16 }}>
        <Skeleton.Input 
          active 
          style={{ width: 300, height: 32 }} 
        />
      </div>

      {/* 统计卡片骨架 */}
      <Row gutter={[16, 16]}>
        {[1, 2, 3, 4].map(i => (
          <Col span={6} key={i}>
            <Card>
              <Skeleton 
                active 
                paragraph={{ rows: 0 }}
                title={{ width: '60%' }}
              />
              <Skeleton.Input 
                active 
                size="large" 
                style={{ width: '80%', marginTop: 8, height: 32 }} 
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* 图表卡片骨架 */}
      <Card style={{ marginTop: 16 }}>
        <Skeleton 
          active 
          title={{ width: '30%' }}
          paragraph={{ rows: 8 }}
        />
      </Card>

      {/* 表格卡片骨架 */}
      <Card style={{ marginTop: 16 }}>
        <Skeleton 
          active 
          title={{ width: '30%' }}
          paragraph={{ rows: 0 }}
        />
        <Skeleton 
          active 
          paragraph={{ rows: 5 }}
          style={{ marginTop: 16 }}
        />
      </Card>
    </div>
  );
};

export default DashboardSkeleton;

