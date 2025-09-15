import React, { useState, useRef, useEffect } from 'react';
import { Card } from 'antd';
import { DragOutlined } from '@ant-design/icons';
import './index.less';

interface FloatingPanelProps {
  children: React.ReactNode;
  title?: string;
  defaultPosition?: { x: number; y: number };
  width?: number;
  className?: string;
}

const FloatingPanel: React.FC<FloatingPanelProps> = ({
  children,
  title,
  defaultPosition = { x: 20, y: 20 },
  width = 300,
  className = '',
}) => {
  const [position, setPosition] = useState(defaultPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

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
    if (isDragging) {
      const x = e.clientX - dragOffset.x;
      const y = e.clientY - dragOffset.y;
      
      // 获取视口尺寸
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // 限制面板不超出视口
      const boundedX = Math.max(0, Math.min(x, viewportWidth - width));
      const boundedY = Math.max(0, Math.min(y, viewportHeight - 100));
      
      setPosition({ x: boundedX, y: boundedY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
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
          </div>
        }
      >
        {children}
      </Card>
    </div>
  );
};

export default FloatingPanel; 