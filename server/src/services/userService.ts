import { Connection } from 'mysql2/promise';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export interface User {
  id: string;
  username: string;
  password: string;
  email: string;
  role: 'Admin' | 'User';
  created_at: Date;
  updated_at: Date;
}

export interface LoginResponse {
  success: boolean;
  user?: Omit<User, 'password'>;
  error?: string;
}

export interface RegisterResponse {
  success: boolean;
  error?: string;
}

export class UserService {
  constructor(private db: Connection) {}

  // 用户注册
  async register(username: string, password: string, email: string): Promise<RegisterResponse> {
    try {
      // 检查用户名是否已存在
      const [existingUsers] = await this.db.execute(
        'SELECT * FROM users WHERE username = ?',
        [username]
      );
      
      if (Array.isArray(existingUsers) && existingUsers.length > 0) {
        return {
          success: false,
          error: '用户名已存在'
        };
      }

      // 检查邮箱是否已存在
      const [existingEmails] = await this.db.execute(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );
      
      if (Array.isArray(existingEmails) && existingEmails.length > 0) {
        return {
          success: false,
          error: '邮箱已被注册'
        };
      }

      // 创建新用户（默认角色 User）
      const userId = uuidv4();
      await this.db.execute(
        'INSERT INTO users (id, username, password, email, role) VALUES (?, ?, ?, ?, ?)',
        [userId, username, this.hashPassword(password), email, 'User']
      );

      return {
        success: true
      };
    } catch (err) {
      console.error('注册失败:', err);
      return {
        success: false,
        error: '注册失败，请稍后重试'
      };
    }
  }

  // 用户登录
  async login(username: string, password: string): Promise<LoginResponse> {
    try {
      const [rows] = await this.db.execute(
        'SELECT * FROM users WHERE username = ? AND password = ?',
        [username, this.hashPassword(password)]
      );
      
      if (Array.isArray(rows) && rows.length > 0) {
        const user = rows[0] as User;
        // 返回用户信息（不包含密码）
        const { password: _, ...userWithoutPassword } = user;
        
        return {
          success: true,
          user: userWithoutPassword
        };
      }
      
      return {
        success: false,
        error: '用户名或密码错误'
      };
    } catch (err) {
      console.error('登录失败:', err);
      return {
        success: false,
        error: '登录失败，请稍后重试'
      };
    }
  }

  // 验证用户登录
  async validateUser(username: string, password: string): Promise<boolean> {
    try {
      const [rows] = await this.db.execute(
        'SELECT * FROM users WHERE username = ? AND password = ?',
        [username, this.hashPassword(password)]
      );
      
      return Array.isArray(rows) && rows.length > 0;
    } catch (err) {
      console.error('验证用户失败:', err);
      return false;
    }
  }

  // 获取用户信息
  async getUserInfo(userId: string): Promise<Omit<User, 'password'> | null> {
    try {
      const [rows] = await this.db.execute(
        'SELECT id, username, email, role, created_at, updated_at FROM users WHERE id = ?',
        [userId]
      );
      
      if (Array.isArray(rows) && rows.length > 0) {
        return rows[0] as Omit<User, 'password'>;
      }
      return null;
    } catch (err) {
      console.error('获取用户信息失败:', err);
      return null;
    }
  }

  // 密码加密
  private hashPassword(password: string): string {
    return crypto.createHash('md5').update(password).digest('hex');
  }
} 