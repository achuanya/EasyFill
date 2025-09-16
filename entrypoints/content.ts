/**
 * @description  字段匹配系统
 * --------------------------------------------------------------------------
 * @author       游钓四方 <haibao1027@gmail.com>
 * @created      2025-04-13
 * @lastModified 2025-09-16
 * --------------------------------------------------------------------------
 * @copyright    (c) 2025 游钓四方
 * @license      MPL-2.0
 * --------------------------------------------------------------------------
 * @module       entrypoints/content
 */

import { isPasswordFieldFocused } from './utils/cryptoUtils';
import { logger } from './utils/logger';
import { getKeywordSets, KeywordSets } from './utils/keywordService';
import { sendRuntimeMessage, getEncryptedStorageData } from './utils/storageUtils';

/**
 * @description: 启用浏览器的自动完成功能，设置输入框的 autocomplete 属性为 "on"。
 * @function handleAutocomplete
 * @returns {void} 无返回值
 */
function handleAutocomplete() {
  try {
    const inputElements = getAllInputElements();
    logger.info(`找到 ${inputElements.length} 个可填充元素（包括 Shadow DOM）`);
    
    // 设置每个输入框的 autocomplete 属性为 "on"，以启用浏览器的自动完成功能
    inputElements.forEach(input => {
      if (input instanceof HTMLInputElement) {
        input.setAttribute('autocomplete', 'on');
      }
    });

    logger.info('输入框自动完成功能已启用');
  } catch (error) {
    logger.error('启用自动完成功能时发生错误', error);
  }
}

/**
 * @description: 获取所有输入元素，包括 Shadow DOM 内部的元素
 * @function getAllInputElements
 * @returns {Element[]} 返回所有找到的输入元素数组
 */
function getAllInputElements(): Element[] {
  const elements: Element[] = [];
  
  // 递归遍历 Shadow DOM 的函数
  function traverseShadowDOM(root: Document | ShadowRoot | Element) {
    // 获取当前根节点下的所有输入元素
    const inputs = root.querySelectorAll('input, textarea');
    elements.push(...Array.from(inputs));
    
    // 查找所有具有 Shadow Root 的元素
    const allElements = root.querySelectorAll('*');
    allElements.forEach(element => {
      if ((element as any).shadowRoot) {
        logger.info('发现 Shadow DOM，正在遍历', { 
          tagName: element.tagName, 
          shadowRootMode: (element as any).shadowRoot.mode 
        });
        traverseShadowDOM((element as any).shadowRoot as ShadowRoot);
      }
    });
  }
  
  // 从 document 开始遍历
  traverseShadowDOM(document);
  
  return elements;
}

/**
 * @description: 填充表单信息，使用存储的用户数据填充输入框和文本区域。
 * @function fillInputFields
 * @returns {Promise<void>} 返回一个 Promise，表示填充操作的完成状态。
 */
function fillInputFields() {
  try {
    // 检查当前焦点元素是否为密码输入框，如果是则跳过填充
    if (isPasswordFieldFocused()) {
      logger.info('当前焦点在密码输入框，跳过自动填充操作');
      return;
    }
    
    // 首先检查黑名单
    const currentDomain = window.location.hostname;
    
    // 向background发送消息检查当前域名是否在黑名单中
    sendRuntimeMessage({
      action: 'checkDomainInBlacklist',
      domain: currentDomain
    }).then((response) => {
      if (!response || !response.success || !response.data.allowed) {
        logger.info(`域名 ${currentDomain} 在黑名单中，跳过填充`);
        return;
      }
      
      // 如果域名检查通过，继续原有的填充逻辑
      (async () => {
        const name = await getEncryptedStorageData({ key: 'name', storageType: 'sync' });
        const email = await getEncryptedStorageData({ key: 'email', storageType: 'sync' });
        const url = await getEncryptedStorageData({ key: 'url', storageType: 'sync' });
        
        if (name && email && url) {
          logger.info('获取到用户数据，开始填充', { name, email, url });
        } else {
          logger.info('用户数据为空，停止填充', { name, email, url });
          return;
        }

        let keywordSets: KeywordSets;
        try {
          keywordSets = await getKeywordSets();
          
          // 如果昵称和邮箱为空，则不执行填充逻辑
          if (!name || !email) {
            logger.warn("缺少必填项：昵称或邮箱，跳过填充");
            return;
          }

          // 使用新的函数获取所有输入元素（包括 Shadow DOM）
          const inputs = getAllInputElements();
          let fieldsFound = 0;
          let foundFieldTypes = new Set<string>(); // 记录已找到的字段类型
          
          inputs.forEach((input) => {
            const typeAttr = (input.getAttribute("type") || "").toLowerCase();
            const nameAttr = (input.getAttribute("name") || "").toLowerCase();
            const idAttr = (input.getAttribute("id") || "").toLowerCase();
            let valueToSet = ""; // 初始化要设置的值
            let matchedBy = "";  // 记录匹配方式：id, name 或 type
            let fieldType = "";  // 记录字段类型

            // 根据关键字集合和属性匹配，确定要填充的值
            // 检查URL字段
            if (keywordSets.url.has(nameAttr) || keywordSets.url.has(`#${idAttr}`)) {
              valueToSet = url;
              matchedBy = keywordSets.url.has(`#${idAttr}`) ? "id" : "name";
              fieldType = "url";
            } else if (typeAttr === "url" && url) {
              valueToSet = url;
              matchedBy = "type";
              fieldType = "url";
            }
            
            // 检查Email字段
            else if (keywordSets.email.has(nameAttr) || keywordSets.email.has(`#${idAttr}`)) {
              valueToSet = email;
              matchedBy = keywordSets.email.has(`#${idAttr}`) ? "id" : "name";
              fieldType = "email";
            } else if (typeAttr === "email" && email) {
              valueToSet = email;
              matchedBy = "type";
              fieldType = "email";
            }
            
            // 检查Name字段
            else if ((keywordSets.name.has(nameAttr) || keywordSets.name.has(`#${idAttr}`)) && name) {
              valueToSet = name;
              matchedBy = keywordSets.name.has(`#${idAttr}`) ? "id" : "name";
              fieldType = "name";
            }

            // 过滤无关字段
            if (!valueToSet) return;

            // 输出 JSON 格式日志
            const logEntry = {
              name: nameAttr || "",
              id: idAttr || "",
              type: typeAttr || "",
              matchedBy,
              valueToSet,
              inShadowDOM: isInShadowDOM(input)
            };

            // 执行填充操作
            logger.info('填充表单字段', JSON.stringify(logEntry));
            (input as HTMLInputElement).value = valueToSet;
            
            // 触发 input 事件，通知表单值已更改
            const inputEvent = new Event('input', { bubbles: true });
            input.dispatchEvent(inputEvent);
            
            // 触发 change 事件
            const changeEvent = new Event('change', { bubbles: true });
            input.dispatchEvent(changeEvent);
            
            fieldsFound++;
            foundFieldTypes.add(fieldType);
          });

          logger.info(`表单填充完成，成功填充 ${fieldsFound} 个字段`);

          // 检查是否有未找到的字段类型
          const allFieldTypes = ['name', 'email', 'url'];
          const missingFieldTypes = allFieldTypes.filter(type => !foundFieldTypes.has(type));

          // 如果有未找到的字段，尝试使用更通用的选择器
          if (missingFieldTypes.length > 0) {
            logger.info(`通过关键字匹配未能找到所有字段类型: ${missingFieldTypes.join(', ')}，尝试使用通用选择器`);
            let additionalFields = 0;
            
            // 为每种未找到的字段类型尝试通用选择器
            for (const fieldType of missingFieldTypes) {
              let valueToFill = '';
              
              // 设置要填充的值
              switch (fieldType) {
                case 'name':
                  valueToFill = name;
                  break;
                case 'email':
                  valueToFill = email;
                  break;
                case 'url':
                  valueToFill = url;
                  break;
              }
              
              // 从关键字数据源动态生成选择器并在所有根节点中查找
              const keywordSet = keywordSets[fieldType as keyof KeywordSets];
              if (keywordSet) {
                // 为每个关键字生成 placeholder 选择器
                keywordSet.forEach(keyword => {
                  // 跳过以 # 开头的关键字（这些已经在主匹配逻辑中处理过了）
                  if (!keyword.startsWith('#')) {
                    const selector = `input[placeholder*="${keyword}"]`;
                    const element = findElementInAllRoots(selector);
                    if (element && element instanceof HTMLInputElement && !element.value) {
                      element.value = valueToFill;
                      element.dispatchEvent(new Event('input', { bubbles: true }));
                      element.dispatchEvent(new Event('change', { bubbles: true }));
                      additionalFields++;
                      logger.info(`使用通用选择器填充字段: ${selector}`, { 
                        fieldType, 
                        value: valueToFill,
                        inShadowDOM: isInShadowDOM(element)
                      });
                      return; // 找到一个就跳出，避免重复填充
                    }
                  }
                });
                
                // 添加 type 选择器（如果适用）
                if (fieldType === 'email') {
                  const element = findElementInAllRoots('input[type="email"]');
                  if (element && element instanceof HTMLInputElement && !element.value) {
                    element.value = valueToFill;
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    additionalFields++;
                    logger.info(`使用类型选择器填充字段: input[type="email"]`, { 
                      fieldType, 
                      value: valueToFill,
                      inShadowDOM: isInShadowDOM(element)
                    });
                  }
                } else if (fieldType === 'url') {
                  const element = findElementInAllRoots('input[type="url"]');
                  if (element && element instanceof HTMLInputElement && !element.value) {
                    element.value = valueToFill;
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    additionalFields++;
                    logger.info(`使用类型选择器填充字段: input[type="url"]`, { 
                      fieldType, 
                      value: valueToFill,
                      inShadowDOM: isInShadowDOM(element)
                    });
                  }
                }
              }
            }
            
            if (additionalFields > 0) {
              logger.info(`使用通用选择器额外找到并填充了 ${additionalFields} 个字段`);
            }
          }
        } catch (error) {
          logger.error('解密或填充表单数据时出错', error);
        }
      })().catch(error => {
        logger.error('异步填充操作失败', error);
      });
    }).catch(error => {
      logger.error('域名检查失败', error);
    });
  } catch (error) {
    logger.error('获取存储数据时出错', error);
  }
}

/**
 * @description: 在所有根节点（包括 Shadow DOM）中查找元素
 * @function findElementInAllRoots
 * @param {string} selector CSS 选择器
 * @returns {Element | null} 找到的第一个元素或 null
 */
function findElementInAllRoots(selector: string): Element | null {
  // 递归查找函数
  function searchInRoot(root: Document | ShadowRoot | Element): Element | null {
    // 在当前根节点中查找
    const element = root.querySelector(selector);
    if (element) {
      return element;
    }
    
    // 在 Shadow DOM 中递归查找
    const allElements = root.querySelectorAll('*');
    for (const el of allElements) {
      const anyEl = el as any;
      if (anyEl.shadowRoot) {
        const found = searchInRoot(anyEl.shadowRoot as ShadowRoot);
        if (found) {
          return found;
        }
      }
    }
    
    return null;
  }
  
  return searchInRoot(document);
}

/**
 * @description: 检查元素是否在 Shadow DOM 中
 * @function isInShadowDOM
 * @param {Element} element 要检查的元素
 * @returns {boolean} 如果元素在 Shadow DOM 中返回 true
 */
function isInShadowDOM(element: Element): boolean {
  let parent: Node | null = element.parentNode;
  while (parent) {
    if (parent instanceof ShadowRoot) {
      return true;
    }
    parent = parent.parentNode;
  }
  return false;
}

// =============================================================================
// 统一的自动填充调度器：限制最小触发间隔，防止过于频繁
// =============================================================================
const MIN_AUTOFILL_INTERVAL_MS = 4000; // 不能太短也不能太长：4 秒更均衡
let lastFillAt = 0;
let pendingTimer: number | null = null;

function performFill() {
  try {
    handleAutocomplete();
    fillInputFields();
  } finally {
    lastFillAt = Date.now();
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  }
}

function requestFill(reason?: string) {
  const now = Date.now();
  const elapsed = now - lastFillAt;

  if (elapsed >= MIN_AUTOFILL_INTERVAL_MS) {
    logger.info(`立即执行自动填充（原因: ${reason || '触发'}）`);
    performFill();
  } else {
    const delay = MIN_AUTOFILL_INTERVAL_MS - elapsed;
    if (pendingTimer) {
      clearTimeout(pendingTimer);
    }
    logger.info(`计划在 ${delay} ms 后执行自动填充（原因: ${reason || '触发'}）`);
    pendingTimer = window.setTimeout(() => performFill(), delay);
  }
}

/**
 * @description: 定义内容脚本，处理页面上的自动填充逻辑
 * @function defineContentScript
 * @returns {void} 无返回值
 */
export default defineContentScript({
  matches: ['<all_urls>'], // 匹配所有 URL
  runAt: 'document_idle',  // 在页面完全加载后运行

  main() {
    // 页面刚载入时立刻自动填充一次
    performFill();

    // 监听 textarea 的输入事件，随时填充（通过调度器限频）
    document.addEventListener("input", (event) => {
      if (event.target instanceof HTMLTextAreaElement) {
        requestFill('textarea-input');
      }
    });

    // 监听 DOM 变化，以处理动态创建的 Shadow DOM（通过调度器限频）
    const observer = new MutationObserver((mutations) => {
      let shouldRefill = false;
      
      mutations.forEach((mutation) => {
        // 检查是否有新的节点被添加
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof Element) {
              const anyNode = node as any;
              // 检查新添加的节点是否包含 Shadow DOM 或输入元素
              if (anyNode.shadowRoot || 
                  node.querySelector('input, textarea') || 
                  node.matches('input, textarea')) {
                shouldRefill = true;
              }
            }
          });
        }
      });
      
      if (shouldRefill) {
        logger.info('检测到 DOM 变化，准备重新执行填充');
        requestFill('mutation-observer');
      }
    });

    // 开始观察 DOM 变化
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    logger.info('EasyFill 内容脚本已启动，支持 Shadow DOM');
  }
});