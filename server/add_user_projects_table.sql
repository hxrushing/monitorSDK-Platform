-- 创建用户项目权限关联表
-- 用于存储用户与项目的权限关系，实现数据隔离

USE `sdk-platform`;

-- 创建用户项目权限关联表
CREATE TABLE IF NOT EXISTS user_projects (
  user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
  project_id VARCHAR(36) NOT NULL COMMENT '项目ID',
  created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  -- 复合主键：确保每个用户对每个项目只有一条权限记录，同时优化查询性能
  PRIMARY KEY (user_id, project_id),
  -- 索引：优化按项目查询用户的性能（user_id已在主键中，无需额外索引）
  INDEX idx_project_id (project_id),
  -- 外键约束：用户ID必须存在于users表
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  -- 外键约束：项目ID必须存在于projects表
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户项目权限关联表';

-- 为现有数据创建默认权限（可选）
-- 如果admin用户不存在权限记录，为其分配所有项目的权限
-- 注意：这个逻辑可以通过应用层处理，这里仅作为示例

