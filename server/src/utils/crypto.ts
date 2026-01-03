/**
 * 加密工具
 * - RSA 密钥对管理
 * - 密码解密
 * - 密码哈希（从 MD5 升级到更安全的方案）
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// RSA 密钥文件路径
const RSA_PRIVATE_KEY_PATH = path.join(__dirname, '../../keys/private.pem');
const RSA_PUBLIC_KEY_PATH = path.join(__dirname, '../../keys/public.pem');
const KEYS_DIR = path.dirname(RSA_PRIVATE_KEY_PATH);

/**
 * 生成 RSA 密钥对
 */
function generateRSAKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  return { publicKey, privateKey };
}

/**
 * 确保密钥文件存在，如果不存在则生成
 */
function ensureRSAKeys(): { publicKey: string; privateKey: string } {
  // 确保目录存在
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }

  // 如果密钥文件不存在，生成新的密钥对
  if (!fs.existsSync(RSA_PRIVATE_KEY_PATH) || !fs.existsSync(RSA_PUBLIC_KEY_PATH)) {
    console.log('[Crypto] 生成新的 RSA 密钥对...');
    const { publicKey, privateKey } = generateRSAKeyPair();
    
    fs.writeFileSync(RSA_PRIVATE_KEY_PATH, privateKey, { mode: 0o600 }); // 只读权限
    fs.writeFileSync(RSA_PUBLIC_KEY_PATH, publicKey, { mode: 0o644 });
    
    console.log('[Crypto] RSA 密钥对已生成');
    return { publicKey, privateKey };
  }

  // 读取现有密钥
  const publicKey = fs.readFileSync(RSA_PUBLIC_KEY_PATH, 'utf-8');
  const privateKey = fs.readFileSync(RSA_PRIVATE_KEY_PATH, 'utf-8');

  return { publicKey, privateKey };
}

// 初始化密钥
let rsaKeys: { publicKey: string; privateKey: string } | null = null;

/**
 * 获取 RSA 公钥
 */
export function getRSAPublicKey(): string {
  if (!rsaKeys) {
    rsaKeys = ensureRSAKeys();
  }
  return rsaKeys.publicKey;
}

/**
 * 获取 RSA 私钥
 */
function getRSAPrivateKey(): string {
  if (!rsaKeys) {
    rsaKeys = ensureRSAKeys();
  }
  return rsaKeys.privateKey;
}

/**
 * RSA 解密（支持降级方案）
 * @param encryptedData Base64 编码的加密数据或降级方案数据
 * @returns 解密后的明文
 */
export function decryptRSA(encryptedData: string): string {
  try {
    // 检查是否是简单编码方案
    if (encryptedData.startsWith('SIMPLE:')) {
      const encoded = encryptedData.substring(7);
      return decodeURIComponent(escape(Buffer.from(encoded, 'base64').toString()));
    }
    
    // 检查是否是降级方案
    if (encryptedData.startsWith('FALLBACK:')) {
      return decryptFallback(encryptedData);
    }
    
    // 检查是否是明文（仅用于调试）
    if (encryptedData.startsWith('PLAIN:')) {
      console.warn('[Crypto] 收到明文密码，这不安全！');
      return encryptedData.substring(6); // 移除 "PLAIN:" 前缀
    }

    // 正常的RSA解密
    const privateKey = getRSAPrivateKey();
    const buffer = Buffer.from(encryptedData, 'base64');
    
    const decrypted = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      buffer
    );

    return decrypted.toString('utf-8');
  } catch (error) {
    console.error('[Crypto] 解密失败:', error);
    throw new Error('解密失败');
  }
}

/**
 * 降级方案解密
 * @param encryptedData 降级方案加密的数据
 * @returns 解密后的明文
 */
function decryptFallback(encryptedData: string): string {
  try {
    // 移除 "FALLBACK:" 前缀
    const encoded = encryptedData.substring(9);
    
    // Base64 解码
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    
    // 解析格式：timestamp:random:data
    const parts = decoded.split(':');
    if (parts.length >= 3) {
      // 提取原始数据（可能包含冒号）
      const data = parts.slice(2).join(':');
      console.log('[Crypto] 降级方案解密成功');
      return data;
    } else {
      throw new Error('降级数据格式错误');
    }
  } catch (error) {
    console.error('[Crypto] 降级方案解密失败:', error);
    throw new Error('降级解密失败');
  }
}

/**
 * 密码哈希（使用 SHA-256 + Salt，比 MD5 更安全）
 * 注意：如果未来要使用 bcrypt，可以在这里替换实现
 * @param password 明文密码
 * @returns 哈希后的密码（格式：salt:hash）
 */
export function hashPassword(password: string): string {
  // 生成随机盐
  const salt = crypto.randomBytes(16).toString('hex');
  
  // 使用 SHA-256 哈希（加盐）
  const hash = crypto
    .createHash('sha256')
    .update(password + salt)
    .digest('hex');
  
  // 返回 salt:hash 格式
  return `${salt}:${hash}`;
}

/**
 * 验证密码
 * @param password 明文密码
 * @param hashedPassword 哈希后的密码（格式：salt:hash）
 * @returns 是否匹配
 */
export function verifyPassword(password: string, hashedPassword: string): boolean {
  try {
    console.log('[Crypto] 验证密码 - 明文长度:', password?.length, '哈希长度:', hashedPassword?.length);
    
    // 兼容旧的 MD5 哈希（如果没有冒号，认为是旧格式）
    if (!hashedPassword.includes(':')) {
      console.log('[Crypto] 检测到MD5格式哈希');
      // 旧格式：MD5 哈希
      const md5Hash = crypto.createHash('md5').update(password).digest('hex');
      console.log('[Crypto] 计算的MD5:', md5Hash);
      console.log('[Crypto] 存储的MD5:', hashedPassword);
      const result = md5Hash === hashedPassword;
      console.log('[Crypto] MD5验证结果:', result);
      return result;
    }

    console.log('[Crypto] 检测到SHA256格式哈希');
    // 新格式：salt:hash
    const [salt, hash] = hashedPassword.split(':');
    if (!salt || !hash) {
      console.log('[Crypto] 哈希格式错误 - 缺少盐值或哈希');
      return false;
    }

    // 计算哈希
    const computedHash = crypto
      .createHash('sha256')
      .update(password + salt)
      .digest('hex');

    console.log('[Crypto] 盐值:', salt);
    console.log('[Crypto] 存储的哈希:', hash);
    console.log('[Crypto] 计算的哈希:', computedHash);
    
    const result = computedHash === hash;
    console.log('[Crypto] SHA256验证结果:', result);
    return result;
  } catch (error) {
    console.error('[Crypto] 密码验证失败:', error);
    return false;
  }
}

/**
 * 检查是否为旧格式的 MD5 哈希
 */
export function isLegacyMD5Hash(hashedPassword: string): boolean {
  return !hashedPassword.includes(':') && hashedPassword.length === 32;
}
























