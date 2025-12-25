/**
 * RSA 加密工具
 * 用于在客户端加密敏感信息（如密码）后再发送到服务器
 */

/**
 * 检查浏览器是否支持 Web Crypto API
 */
function isWebCryptoSupported(): boolean {
  return !!(window.crypto && window.crypto.subtle && window.crypto.subtle.importKey);
}

/**
 * 检查是否在安全上下文中（HTTPS 或 localhost）
 */
function isSecureContext(): boolean {
  return window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost';
}

/**
 * RSA 公钥加密
 * @param data 要加密的数据
 * @param publicKey RSA 公钥（PEM 格式）
 * @returns Base64 编码的加密结果
 */
export async function encryptWithRSA(data: string, publicKey: string): Promise<string> {
  try {
    // 检查浏览器支持
    if (!isWebCryptoSupported()) {
      console.warn('浏览器不支持 Web Crypto API，使用降级方案');
      return fallbackEncrypt(data);
    }

    // 检查安全上下文
    if (!isSecureContext()) {
      console.warn('非安全上下文，Web Crypto API 可能不可用，使用降级方案');
      return fallbackEncrypt(data);
    }

    // 清理 PEM 格式的公钥
    const pemHeader = '-----BEGIN PUBLIC KEY-----';
    const pemFooter = '-----END PUBLIC KEY-----';
    const pemContents = publicKey
      .replace(pemHeader, '')
      .replace(pemFooter, '')
      .replace(/\s/g, '');
    
    // Base64 解码为二进制
    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
    
    // 使用 Web Crypto API 导入公钥
    const key = await window.crypto.subtle.importKey(
      'spki',
      binaryDer.buffer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      false,
      ['encrypt']
    );

    // 加密数据（RSA-OAEP 最大加密长度受密钥大小限制，2048位密钥最多加密 190 字节）
    const encodedData = new TextEncoder().encode(data);
    if (encodedData.length > 190) {
      throw new Error('密码长度超出加密限制');
    }

    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP',
      },
      key,
      encodedData
    );

    // 转换为 Base64
    const encryptedArray = new Uint8Array(encrypted);
    return btoa(String.fromCharCode(...encryptedArray));
  } catch (error) {
    console.error('RSA加密失败:', error);
    console.warn('RSA加密失败，使用降级方案');
    return fallbackEncrypt(data);
  }
}

/**
 * 降级加密方案（简单的Base64编码 + 时间戳混淆）
 * 注意：这不是真正的加密，只是为了兼容性的临时方案
 * @param data 要编码的数据
 * @returns 编码后的字符串
 */
function fallbackEncrypt(data: string): string {
  try {
    // 添加时间戳和随机数作为混淆
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2);
    const mixed = `${timestamp}:${random}:${data}`;
    
    // Base64 编码（直接编码UTF-8字符串）
    const encoded = btoa(unescape(encodeURIComponent(mixed)));
    
    // 添加标识前缀，表示这是降级方案
    return `FALLBACK:${encoded}`;
  } catch (error) {
    console.error('降级加密失败:', error);
    // 如果连Base64都失败，直接返回原文（仅用于调试）
    return `PLAIN:${data}`;
  }
}

/**
 * 获取并缓存 RSA 公钥
 */
let cachedPublicKey: string | null = null;

/**
 * 获取 RSA 公钥（带缓存）
 * @returns RSA 公钥
 */
export async function getPublicKey(): Promise<string> {
  if (cachedPublicKey) {
    return cachedPublicKey;
  }

  try {
    const response = await fetch('/api/public-key');
    if (!response.ok) {
      throw new Error('获取公钥失败');
    }
    const data = await response.json();
    const publicKey = data.publicKey;
    if (!publicKey || typeof publicKey !== 'string') {
      throw new Error('无效的公钥格式');
    }
    cachedPublicKey = publicKey;
    return cachedPublicKey;
  } catch (error) {
    console.error('获取公钥失败:', error);
    throw new Error('获取加密密钥失败，请重试');
  }
}

/**
 * 加密密码（自动获取公钥并加密）
 * @param password 明文密码
 * @returns 加密后的密码（Base64）
 */
export async function encryptPassword(password: string): Promise<string> {
  // 检查浏览器支持和安全上下文
  if (!isWebCryptoSupported() || !isSecureContext()) {
    console.warn('Web Crypto API 不可用，使用简单编码');
    // 简单的Base64编码，添加前缀标识
    return `SIMPLE:${btoa(unescape(encodeURIComponent(password)))}`;
  }

  try {
    const publicKey = await getPublicKey();
    return encryptWithRSA(password, publicKey);
  } catch (error) {
    console.warn('RSA加密失败，使用简单编码:', error);
    return `SIMPLE:${btoa(unescape(encodeURIComponent(password)))}`;
  }
}

