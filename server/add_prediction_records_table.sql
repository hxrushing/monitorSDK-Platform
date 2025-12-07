-- 创建预测记录表
-- 用于保存用户的预测历史记录

USE `sdk-platform`;

-- 创建预测记录表
CREATE TABLE IF NOT EXISTS prediction_records (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36),
  metric_type VARCHAR(20) NOT NULL COMMENT '预测指标类型: pv, uv, conversion_rate',
  model_type VARCHAR(10) NOT NULL COMMENT '预测模型: lstm, gru',
  prediction_days INT NOT NULL COMMENT '预测天数',
  predictions JSON NOT NULL COMMENT '预测结果数据',
  historical_data JSON COMMENT '历史数据快照',
  model_info JSON COMMENT '模型信息',
  created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_project (project_id),
  INDEX idx_user (user_id),
  INDEX idx_metric_type (metric_type),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='预测记录表';

