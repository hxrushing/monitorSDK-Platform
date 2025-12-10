import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, Tooltip } from 'antd';
import { DragOutlined, MinusOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons';
import './index.less';

interface FloatingPanelProps {
  children: React.ReactNode;
  title?: string;
  defaultPosition?: { x: number; y: number };
  width?: number;
  className?: string;
  icon?: React.ReactNode;
  onClose?: () => void;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

const FloatingPanel: React.FC<FloatingPanelProps> = ({
  children,
  title,
  defaultPosition = { x: 20, y: 20 },
  width = 300,
  className = '',
  icon,
  onClose,
  collapsible = true,
  defaultCollapsed = false,
}) => {
  const [position, setPosition] = useState(defaultPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const panelRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const pendingPositionRef = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('.floating-panel-header')) {
      setIsDragging(true);
      const rect = panelRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    const x = e.clientX - dragOffset.x;
    const y = e.clientY - dragOffset.y;
    
    // 获取视口尺寸（这些属性不会触发重排）
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // 限制面板不超出视口
    const boundedX = Math.max(0, Math.min(x, viewportWidth - width));
    const boundedY = Math.max(0, Math.min(y, viewportHeight - 100));
    
    // 保存待更新的位置
    pendingPositionRef.current = { x: boundedX, y: boundedY };
    
    // 使用 requestAnimationFrame 节流，避免频繁更新状态导致重排
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        if (pendingPositionRef.current) {
          setPosition(pendingPositionRef.current);
          pendingPositionRef.current = null;
        }
        rafIdRef.current = null;
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    // 取消待处理的动画帧
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    // 应用最后一次位置更新
    if (pendingPositionRef.current) {
      setPosition(pendingPositionRef.current);
      pendingPositionRef.current = null;
    }
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // 如果收起状态，显示图标栏
  if (collapsed) {
    return (
      <div
        ref={panelRef}
        className={`floating-panel floating-panel-collapsed ${className}`}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          zIndex: 1000,
        }}
        onMouseDown={handleMouseDown}
      >
        <Tooltip title={title} placement="right">
          <div className="floating-panel-icon-bar">
            {icon || <DragOutlined />}
            <div className="floating-panel-actions">
              <Button
                type="text"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setCollapsed(false)}
                className="floating-panel-action-btn"
              />
              {onClose && (
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={onClose}
                  className="floating-panel-action-btn"
                />
              )}
            </div>
          </div>
        </Tooltip>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className={`floating-panel ${className}`}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: width,
        zIndex: 1000,
      }}
      onMouseDown={handleMouseDown}
    >
      <Card
        size="small"
        title={
          <div className="floating-panel-header">
            <DragOutlined style={{ marginRight: 8 }} />
            {title}
            <div className="floating-panel-header-actions">
              {collapsible && (
                <Button
                  type="text"
                  size="small"
                  icon={<MinusOutlined />}
                  onClick={() => setCollapsed(true)}
                  className="floating-panel-action-btn"
                />
              )}
              {onClose && (
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={onClose}
                  className="floating-panel-action-btn"
                />
              )}
            </div>
          </div>
        }
      >
        {children}
      </Card>
    </div>
  );
};

export default FloatingPanel; 