import React from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import './RouteLoading.less';

/**
 * 路由加载组件
 * 专门用于路由懒加载，提供更好的视觉反馈
 */
const RouteLoading: React.FC = () => {
  return (
    <div className="route-loading">
      <div className="route-loading-content">
        <Spin 
          size="large"
          indicator={<LoadingOutlined className="route-loading-icon" spin />}
        />
        <div className="route-loading-text">
          请稍候，正在为您加载内容
        </div>
      </div>
    </div>
  );
};

export default RouteLoading;

