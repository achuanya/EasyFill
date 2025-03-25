/**
 * @description: 提供加密和解密功能的工具函数，基于 AES-GCM 算法。
 * @author: 游钓四方
 * @date: 2025-3-25
 */

const ENCRYPTION_KEY = new Uint8Array([
  101, 97, 115, 121, 102, 105, 108, 108, 45, 115, 101, 99, 114, 101, 116, 45,
  107, 101, 121, 45, 51, 50, 98, 121, 116, 101, 115, 45, 108, 111, 110, 103,
]); // 固定 32 字节密钥，用于加密和解密

const DEBUG_MODE = false; // 调试开关

/**
 * @description: 获取 AES-GCM 加密密钥。
 * @returns {Promise<CryptoKey>} 返回一个 Promise，解析为 CryptoKey。
 */
async function getKey() {
  return crypto.subtle.importKey(
    'raw',
    ENCRYPTION_KEY, // 使用固定长度的 Uint8Array
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * @description: 加密数据。
 * @param {string} data - 要加密的字符串数据。
 * @returns {Promise<string>} 返回一个 Promise，解析为加密后的 Base64 字符串。
 */
export async function encryptData(data: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 生成随机 IV
  const enc = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(data)
  );
  const result = `${btoa(String.fromCharCode(...iv))}:${btoa(String.fromCharCode(...new Uint8Array(encrypted)))}`;
  
  if (DEBUG_MODE) {
    console.log('加密成功:', { data, iv: Array.from(iv), encrypted: result });
  }
  
  return result;
}

/**
 * @description: 解密数据。
 * @param {string} encryptedData - 加密后的 Base64 字符串。
 * @returns {Promise<string>} 返回一个 Promise，解析为解密后的字符串。
 */
export async function decryptData(encryptedData: string): Promise<string> {
  const [ivBase64, dataBase64] = encryptedData.split(':'); // 分离 IV 和加密数据
  const iv = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0)); // 解码 IV
  const encrypted = Uint8Array.from(atob(dataBase64), (c) => c.charCodeAt(0)); // 解码加密数据
  const key = await getKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );
  const dec = new TextDecoder();
  const result = dec.decode(decrypted);

  if (DEBUG_MODE) {
    console.log('解密成功:', { encryptedData, iv: Array.from(iv), decrypted: result });
  }

  return result;
}
