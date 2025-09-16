/**
 * @description  AES-GCM 加密和解密工具函数
 * --------------------------------------------------------------------------
 * @author       游钓四方 <haibao1027@gmail.com>
 * @created      2025-04-13
 * @lastModified 2025-09-16
 * --------------------------------------------------------------------------
 * @copyright    (c) 2025 游钓四方
 * @license      MPL-2.0
 * --------------------------------------------------------------------------
 * @module       utils/cryptoUtils
 */

import { logger } from './logger';

const ENCRYPTION_KEY = new Uint8Array([
  101, 97, 115, 121, 102, 105, 108, 108, 45, 115, 101, 99, 114, 101, 116, 45,
  107, 101, 121, 45, 51, 50, 98, 121, 116, 101, 115, 45, 108, 111, 110, 103,
]); // 固定 32 字节密钥，用于加密和解密

/**
 * @description: 获取 AES-GCM 加密密钥。
 * @returns {Promise<CryptoKey>} 返回一个 Promise，解析为 CryptoKey。
 */
async function getKey() {
  try {
    return await crypto.subtle.importKey(
      'raw',
      ENCRYPTION_KEY, // 使用固定长度的 Uint8Array
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  } catch (error) {
    logger.error('获取加密密钥失败', error);
    throw error;
  }
}

/**
 * @description: 加密数据。
 * @param {string} data - 要加密的字符串数据。
 * @returns {Promise<string>} 返回一个 Promise，解析为加密后的 Base64 字符串。
 */
export async function encryptData(data: string): Promise<string> {
  if (!data) {
    logger.info('加密跳过: 数据为空');
    return '';
  }

  try {
    const key = await getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 生成随机 IV
    const enc = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(data)
    );
    const result = `${btoa(String.fromCharCode(...iv))}:${btoa(String.fromCharCode(...new Uint8Array(encrypted)))}`;
    
    logger.info('加密成功', { data, iv: Array.from(iv), encrypted: result });
    return result;
  } catch (error) {
    logger.error('加密数据时出错', error);
    throw error; // 重新抛出错误
  }
}

/**
 * @description: 解密数据。
 * @param {string} encryptedData - 加密后的 Base64 字符串。
 * @returns {Promise<string>} 返回一个 Promise，解析为解密后的字符串。
 */
export async function decryptData(encryptedData: string): Promise<string> {
  if (!encryptedData) {
    logger.info('解密跳过: 数据为空');
    return '';
  }
  
  try {
    const [ivBase64, dataBase64] = encryptedData.split(':'); // 分离 IV 和加密数据
    
    if (!ivBase64 || !dataBase64) {
      throw new Error('加密数据格式无效');
    }
    
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

    logger.info('解密成功', { encryptedData, iv: Array.from(iv), decrypted: result });
    return result;
  } catch (error) {
    logger.error('解密数据时出错', error);
    throw error;
  }
}

/**
 * @description: 检查一个给定的元素是否是密码字段。
 * 这不仅仅检查 type='password'，还检查 autocomplete 属性以处理“显示密码”等情况。
 * @param element 需要检查的元素
 * @returns {boolean}
 */
export function isPasswordElement(element: Element | null): boolean {
  if (!element || typeof (element as any).getAttribute !== 'function') {
    return false;
  }

  if (element.tagName !== 'INPUT') {
    return false;
  }

  const inputElement = element as HTMLInputElement;

  // 直接检查 type 属性
  if (inputElement.type.toLowerCase() === 'password') {
    return true;
  }

  // 检查 autocomplete 属性，识别处于“显示密码”时的输入框
  const autocomplete = (inputElement.getAttribute('autocomplete') || '').toLowerCase();
  if (autocomplete === 'current-password' || autocomplete === 'new-password') {
    return true;
  }

  return false;
}

/**
 * @description: 递归地检查当前焦点元素是否为密码输入框，支持 Shadow DOM 和 iframes。
 * @returns {boolean} 如果当前焦点元素是密码输入框则返回 true
 */
export function isPasswordFieldFocused(): boolean {
  let activeElement: Element | null = document.activeElement;
  
  // 使用一个 Set 来防止无限循环（例如，两个 iframe 互相引用）
  const visited = new Set<Element | Document>();

  while (activeElement && !visited.has(activeElement)) {
    visited.add(activeElement);

    if (isPasswordElement(activeElement)) {
      return true;
    }

    // Shadow DOM 中的焦点
    if ((activeElement as any).shadowRoot && (activeElement as any).shadowRoot.activeElement) {
      activeElement = (activeElement as any).shadowRoot.activeElement as Element;
      continue;
    }

    // iframe 中的焦点
    if (activeElement.tagName === 'IFRAME') {
      const iframe = activeElement as HTMLIFrameElement;
      try {
        if (iframe.contentDocument) {
          visited.add(iframe.contentDocument);
          activeElement = iframe.contentDocument.activeElement;
          continue;
        }
      } catch (e) {
        // 跨域 iframe 无法访问
        console.warn('Cannot access cross-origin iframe:', iframe);
        return false;
      }
    }
    break;
  }
  
  return isPasswordElement(activeElement);
}