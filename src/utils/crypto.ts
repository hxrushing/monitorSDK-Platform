/**
 * RSA 加密工具
 * 用于在客户端加密敏感信息（如密码）后再发送到服务器
 */

/**
 * RSA 公钥加密
 * @param data 要加密的数据
 * @param publicKey RSA 公钥（PEM 格式）
 * @returns Base64 编码的加密结果
 */
export async function encryptWithRSA(data: string, publicKey: string): Promise<string> {
  try {
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
    throw new Error('加密失败，请重试');
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
    cachedPublicKey = data.publicKey;
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
  const publicKey = await getPublicKey();
  return encryptWithRSA(password, publicKey);
}

