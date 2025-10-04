import React, { useEffect } from 'react';
import AnalyticsSDK from '@/sdk';
import useGlobalStore from '@/store/globalStore';

const containerStyle: React.CSSProperties = {
  minHeight: 'calc(100vh - 120px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, #f6f8fb 0%, #eef2f7 100%)',
  padding: 24
};

const cardStyle: React.CSSProperties = {
  width: 720,
  maxWidth: '92vw',
  background: '#fff',
  borderRadius: 16,
  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
  padding: 28,
  border: '1px solid #eef0f3'
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 18
};

const titleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  color: '#1f2328'
};

const descStyle: React.CSSProperties = {
  color: '#57606a',
  marginBottom: 20
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12
};

const primaryBtn: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #1f6feb',
  background: 'linear-gradient(180deg,#2f81f7,#1f6feb)',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'transform .05s ease, box-shadow .2s ease',
  boxShadow: '0 6px 14px rgba(31,111,235,.25)'
};

const secondaryBtn: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #d0d7de',
  background: '#f6f8fa',
  color: '#24292f',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'transform .05s ease, box-shadow .2s ease'
};

const ghostBtn: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px dashed #d0d7de',
  background: '#fff',
  color: '#57606a',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'transform .05s ease, box-shadow .2s ease'
};

const SDKDemo: React.FC = () => {
  const selectedProjectId = useGlobalStore(state => state.selectedProjectId);

  useEffect(() => {
    // 清理之前的SDK实例
    AnalyticsSDK.clearAllInstances();
    
    const sdk = AnalyticsSDK.getInstance(
      selectedProjectId,
      (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api') + '/track'
    );
    sdk.setUser('user-123');
    sdk.track('页面浏览', { 路径: location.pathname, 项目ID: selectedProjectId });
  }, [selectedProjectId]);

  const withSDK = () =>
    AnalyticsSDK.getInstance(
      selectedProjectId,
      (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api') + '/track'
    );

  const handlePrimary = () => {
    const sdk = withSDK();
    sdk.track('点击事件1', { 按钮: '立即购买' });
  };

  const handleSecondary = () => {
    const sdk = withSDK();
    sdk.track('点击事件2', { 按钮: '加入收藏' });
  };

  const handleGhost = () => {
    const sdk = withSDK();
    sdk.track('点击事件3', { 按钮: '更多操作' });
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div style={titleStyle}>SDK 示例页</div>
        </div>
        <div style={descStyle}>页面加载时已自动上报「页面浏览」。点击下方按钮可体验事件上报。</div>
        <div style={gridStyle}>
          <button style={primaryBtn} onClick={handlePrimary}>点击事件1</button>
          <button style={secondaryBtn} onClick={handleSecondary}>点击事件2</button>
          <button style={ghostBtn} onClick={handleGhost}>点击事件3</button>
        </div>
      </div>
    </div>
  );
};

export default SDKDemo; 