import { Connection, Pool } from 'mysql2/promise';
import { RowDataPacket } from 'mysql2';

type DBClient = Connection | Pool;

export interface UserProjectPermission {
  user_id: string;
  project_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectWithPermission {
  id: string;
  name: string;
  description: string;
  owner_id: string | null;
  created_at: Date;
  updated_at: Date;
  has_permission: boolean;
}

export class ProjectPermissionService {
  constructor(private db: DBClient) {}

  /**
   * 为用户分配项目权限
   * @param userId 用户ID
   * @param projectId 项目ID
   */
  async assignPermission(userId: string, projectId: string): Promise<void> {
    try {
      // 检查用户和项目是否存在
      const [userRows] = await this.db.execute<RowDataPacket[]>(
        'SELECT id FROM users WHERE id = ?',
        [userId]
      );
      
      if (!Array.isArray(userRows) || userRows.length === 0) {
        throw new Error('用户不存在');
      }

      const [projectRows] = await this.db.execute<RowDataPacket[]>(
        'SELECT id FROM projects WHERE id = ?',
        [projectId]
      );
      
      if (!Array.isArray(projectRows) || projectRows.length === 0) {
        throw new Error('项目不存在');
      }

      // 使用 INSERT IGNORE 避免重复插入时的错误
      await this.db.execute(
        'INSERT IGNORE INTO user_projects (user_id, project_id) VALUES (?, ?)',
        [userId, projectId]
      );
    } catch (err: any) {
      console.error('分配项目权限失败:', err);
      if (err.message === '用户不存在' || err.message === '项目不存在') {
        throw err;
      }
      throw new Error('分配项目权限失败，请稍后重试');
    }
  }

  /**
   * 移除用户的项目权限
   * @param userId 用户ID
   * @param projectId 项目ID
   */
  async removePermission(userId: string, projectId: string): Promise<void> {
    try {
      await this.db.execute(
        'DELETE FROM user_projects WHERE user_id = ? AND project_id = ?',
        [userId, projectId]
      );
    } catch (err) {
      console.error('移除项目权限失败:', err);
      throw new Error('移除项目权限失败，请稍后重试');
    }
  }

  /**
   * 批量分配项目权限
   * @param userId 用户ID
   * @param projectIds 项目ID数组
   */
  async assignPermissions(userId: string, projectIds: string[]): Promise<void> {
    if (projectIds.length === 0) {
      return;
    }

    try {
      // 检查用户是否存在
      const [userRows] = await this.db.execute<RowDataPacket[]>(
        'SELECT id FROM users WHERE id = ?',
        [userId]
      );
      
      if (!Array.isArray(userRows) || userRows.length === 0) {
        throw new Error('用户不存在');
      }

      // 批量插入（使用 INSERT IGNORE 避免重复）
      const values = projectIds.map(() => '(?, ?)').join(', ');
      const params = projectIds.flatMap(projectId => [userId, projectId]);
      
      await this.db.execute(
        `INSERT IGNORE INTO user_projects (user_id, project_id) VALUES ${values}`,
        params
      );
    } catch (err: any) {
      console.error('批量分配项目权限失败:', err);
      if (err.message === '用户不存在') {
        throw err;
      }
      throw new Error('批量分配项目权限失败，请稍后重试');
    }
  }

  /**
   * 批量移除项目权限
   * @param userId 用户ID
   * @param projectIds 项目ID数组
   */
  async removePermissions(userId: string, projectIds: string[]): Promise<void> {
    if (projectIds.length === 0) {
      return;
    }

    try {
      const placeholders = projectIds.map(() => '?').join(', ');
      await this.db.execute(
        `DELETE FROM user_projects WHERE user_id = ? AND project_id IN (${placeholders})`,
        [userId, ...projectIds]
      );
    } catch (err) {
      console.error('批量移除项目权限失败:', err);
      throw new Error('批量移除项目权限失败，请稍后重试');
    }
  }

  /**
   * 获取用户有权限访问的项目列表
   * @param userId 用户ID
   * @returns 项目列表
   */
  async getUserProjects(userId: string): Promise<ProjectWithPermission[]> {
    try {
      const [rows] = await this.db.execute<RowDataPacket[]>(
        `SELECT 
          p.id,
          p.name,
          p.description,
          p.owner_id,
          p.created_at,
          p.updated_at,
          TRUE as has_permission
        FROM projects p
        INNER JOIN user_projects up ON p.id = up.project_id
        WHERE up.user_id = ?
        ORDER BY p.created_at DESC`,
        [userId]
      );

      return (rows || []).map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        owner_id: row.owner_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        has_permission: true
      }));
    } catch (err) {
      console.error('获取用户项目列表失败:', err);
      throw new Error('获取用户项目列表失败，请稍后重试');
    }
  }

  /**
   * 获取项目的用户权限列表
   * @param projectId 项目ID
   * @returns 用户列表（包含用户基本信息）
   */
  async getProjectUsers(projectId: string): Promise<Array<{
    user_id: string;
    username: string;
    email: string;
    role: string;
    created_at: Date;
  }>> {
    try {
      const [rows] = await this.db.execute<RowDataPacket[]>(
        `SELECT 
          u.id as user_id,
          u.username,
          u.email,
          u.role,
          up.created_at
        FROM users u
        INNER JOIN user_projects up ON u.id = up.user_id
        WHERE up.project_id = ?
        ORDER BY up.created_at DESC`,
        [projectId]
      );

      return (rows || []).map(row => ({
        user_id: row.user_id,
        username: row.username,
        email: row.email,
        role: row.role,
        created_at: row.created_at
      }));
    } catch (err) {
      console.error('获取项目用户列表失败:', err);
      throw new Error('获取项目用户列表失败，请稍后重试');
    }
  }

  /**
   * 检查用户是否有项目权限
   * @param userId 用户ID
   * @param projectId 项目ID
   * @returns 是否有权限
   */
  async hasPermission(userId: string, projectId: string): Promise<boolean> {
    try {
      const [rows] = await this.db.execute<RowDataPacket[]>(
        'SELECT 1 FROM user_projects WHERE user_id = ? AND project_id = ? LIMIT 1',
        [userId, projectId]
      );

      return Array.isArray(rows) && rows.length > 0;
    } catch (err) {
      console.error('检查项目权限失败:', err);
      return false;
    }
  }

  /**
   * 获取用户对指定项目的权限列表（用于批量检查）
   * @param userId 用户ID
   * @param projectIds 项目ID数组
   * @returns 有权限的项目ID数组
   */
  async getUserProjectIds(userId: string, projectIds: string[]): Promise<string[]> {
    if (projectIds.length === 0) {
      return [];
    }

    try {
      const placeholders = projectIds.map(() => '?').join(', ');
      const [rows] = await this.db.execute<RowDataPacket[]>(
        `SELECT project_id FROM user_projects 
         WHERE user_id = ? AND project_id IN (${placeholders})`,
        [userId, ...projectIds]
      );

      return (rows || []).map(row => row.project_id);
    } catch (err) {
      console.error('获取用户项目ID列表失败:', err);
      return [];
    }
  }

  /**
   * 更新用户的项目权限（先删除所有权限，再添加新权限）
   * @param userId 用户ID
   * @param projectIds 新的项目ID数组
   */
  async updateUserProjects(userId: string, projectIds: string[]): Promise<void> {
    try {
      // 开始事务（如果使用Pool，需要考虑事务处理）
      // 由于这里使用的是DBClient（可能是Pool），我们需要使用连接来执行事务
      // 简化处理：先删除所有，再添加新的
      
      // 删除用户的所有项目权限
      await this.db.execute(
        'DELETE FROM user_projects WHERE user_id = ?',
        [userId]
      );

      // 添加新的项目权限
      if (projectIds.length > 0) {
        await this.assignPermissions(userId, projectIds);
      }
    } catch (err) {
      console.error('更新用户项目权限失败:', err);
      throw new Error('更新用户项目权限失败，请稍后重试');
    }
  }
}

