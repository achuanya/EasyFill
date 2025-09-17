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
  const processedShadowRoots = new WeakSet<ShadowRoot>(); // 避免重复遍历同一个Shadow Root
  
  // 递归遍历 Shadow DOM 的函数
  function traverseShadowDOM(root: Document | ShadowRoot | Element) {
    // 如果是ShadowRoot且已经处理过，跳过
    if (root instanceof ShadowRoot && processedShadowRoots.has(root)) {
      return;
    }
    
    // 标记已处理的ShadowRoot
    if (root instanceof ShadowRoot) {
      processedShadowRoots.add(root);
    }
    
    // 获取当前根节点下的所有输入元素
    const inputs = root.querySelectorAll('input, textarea');
    elements.push(...Array.from(inputs));
    
    // 查找所有具有 Shadow Root 的元素
    const allElements = root.querySelectorAll('*');
    allElements.forEach(element => {
      if ((element as any).shadowRoot) {
        const shadowRoot = (element as any).shadowRoot as ShadowRoot;
        if (!processedShadowRoots.has(shadowRoot)) {
          logger.info('发现 Shadow DOM，正在遍历', { 
            tagName: element.tagName, 
            shadowRootMode: shadowRoot.mode 
          });
          traverseShadowDOM(shadowRoot);
        }
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
async function fillInputFields() {
  try {
    // 检查当前焦点元素是否为密码输入框，如果是则跳过填充
    if (isPasswordFieldFocused()) {
      logger.info('当前焦点在密码输入框，跳过自动填充操作');
      return;
    }
    
    // 首先检查黑名单
    const currentDomain = window.location.hostname;
    
    // 向background发送消息检查当前域名是否在黑名单中
    const response = await sendRuntimeMessage({
      action: 'checkDomainInBlacklist',
      domain: currentDomain
    });
    
    if (!response || !response.success || !response.data.allowed) {
      logger.info(`域名 ${currentDomain} 在黑名单中，跳过填充`);
      return;
    }
    
    // 如果域名检查通过，获取用户数据
    const name = await getEncryptedStorageData({ key: 'name', storageType: 'sync' });
    const email = await getEncryptedStorageData({ key: 'email', storageType: 'sync' });
    const url = await getEncryptedStorageData({ key: 'url', storageType: 'sync' });
    
    // 检查必填项
    if (!name || !email) {
      logger.warn("缺少必填项：昵称或邮箱，跳过填充");
      return;
    }
    
    logger.info('获取到用户数据，开始填充', { name, email, url });

    const keywordSets = await getKeywordSets();
    
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
    logger.error('填充表单数据时出错', error);
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
// 填充策略状态管理
// =============================================================================
interface FillState {
  isFirstFillCompleted: boolean;
  isSecondFillCompleted: boolean;
  isAutoFillStopped: boolean;
  lastPageUrl: string;
  lastPageTitle: string;
  pageChangeDetected: boolean;
}

let fillState: FillState = {
  isFirstFillCompleted: false,
  isSecondFillCompleted: false,
  isAutoFillStopped: false,
  lastPageUrl: window.location.href,
  lastPageTitle: document.title,
  pageChangeDetected: false
};

/**
 * @description: 重置填充状态，用于页面变化时重新开始填充策略
 * @function resetFillState
 * @returns {void} 无返回值
 */
function resetFillState() {
  fillState = {
    isFirstFillCompleted: false,
    isSecondFillCompleted: false,
    isAutoFillStopped: false,
    lastPageUrl: window.location.href,
    lastPageTitle: document.title,
    pageChangeDetected: false
  };
  logger.info('填充状态已重置，准备重新执行完整填充策略');
}

/**
 * @description: 检测页面内容是否发生变化（PJAX/AJAX/Astro等）
 * @function detectPageChange
 * @returns {boolean} 如果检测到页面变化返回 true
 */
function detectPageChange(): boolean {
  const currentUrl = window.location.href;
  const currentTitle = document.title;
  
  // 检查 URL 或标题是否发生变化
  if (currentUrl !== fillState.lastPageUrl || currentTitle !== fillState.lastPageTitle) {
    logger.info('检测到页面内容变化', {
      oldUrl: fillState.lastPageUrl,
      newUrl: currentUrl,
      oldTitle: fillState.lastPageTitle,
      newTitle: currentTitle
    });
    
    fillState.lastPageUrl = currentUrl;
    fillState.lastPageTitle = currentTitle;
    return true;
  }
  
  return false;
}

/**
 * @description: 执行填充操作
 * @function performFill
 * @param {string} stage 填充阶段标识
 * @returns {void} 无返回值
 */
async function performFill(stage: string) {
  try {
    logger.info(`执行${stage}填充`);
    handleAutocomplete();
    await fillInputFields();
  } catch (error) {
    logger.error(`${stage}填充时发生错误`, error);
  }
}

/**
 * @description: 执行首次填充（DOM加载前）
 * @function executeFirstFill
 * @returns {void} 无返回值
 */
async function executeFirstFill() {
  if (fillState.isFirstFillCompleted) {
    return;
  }
  
  await performFill('首次');
  fillState.isFirstFillCompleted = true;
  logger.info('首次填充已完成');
}

/**
 * @description: 执行第二次填充（DOM加载完成后）
 * @function executeSecondFill
 * @returns {void} 无返回值
 */
async function executeSecondFill() {
  if (fillState.isSecondFillCompleted) {
    return;
  }
  
  await performFill('第二次');
  fillState.isSecondFillCompleted = true;
  fillState.isAutoFillStopped = true;
  logger.info('第二次填充已完成，自动填充已停止');
}

/**
 * @description: 处理页面变化，重新执行完整填充策略
 * @function handlePageChange
 * @returns {void} 无返回值
 */
async function handlePageChange() {
  logger.info('页面内容发生变化，重新执行完整填充策略');
  resetFillState();
  
  // 立即执行首次填充
  await executeFirstFill();
  
  // 延迟执行第二次填充，确保DOM完全更新
  setTimeout(async () => {
    await executeSecondFill();
  }, 1000);
}

/**
 * @description: 高级页面变化检测器
 * @function setupAdvancedPageChangeDetection
 * @returns {void} 无返回值
 */
function setupAdvancedPageChangeDetection() {
  // 监听 popstate 事件（浏览器前进后退）
  window.addEventListener('popstate', () => {
    logger.info('检测到 popstate 事件');
    handlePageChange();
  });

  // 监听 pushstate 和 replacestate（PJAX/AJAX导航）
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    logger.info('检测到 pushState 事件');
    setTimeout(() => handlePageChange(), 100);
  };

  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    logger.info('检测到 replaceState 事件');
    setTimeout(() => handlePageChange(), 100);
  };

  // 监听 hashchange 事件
  window.addEventListener('hashchange', () => {
    logger.info('检测到 hashchange 事件');
    handlePageChange();
  });

  // 监听 DOM 变化，检测大规模内容更新
  const observer = new MutationObserver((mutations) => {
    // 如果自动填充已停止且未检测到页面变化，检查是否有大规模DOM变化
    if (fillState.isAutoFillStopped && !fillState.pageChangeDetected) {
      let significantChanges = 0;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // 检查是否有大量节点被添加或移除
          if (mutation.addedNodes.length > 5 || mutation.removedNodes.length > 5) {
            significantChanges++;
          }
          
          // 检查是否有重要的结构性变化
          mutation.addedNodes.forEach((node) => {
            if (node instanceof Element) {
              // 检查是否添加了新的表单或输入元素
              if (node.matches('form, input, textarea') || 
                  node.querySelector('form, input, textarea')) {
                significantChanges += 2;
              }
              
              // 检查是否添加了主要的内容区域
              if (node.matches('main, article, section, .content, #content, .main, #main')) {
                significantChanges += 3;
              }
            }
          });
        }
      });
      
      // 如果检测到显著变化，可能是页面内容更新
      if (significantChanges >= 3) {
        logger.info(`检测到显著DOM变化 (${significantChanges}个变化点)，可能是页面内容更新`);
        
        // 检查URL或标题是否也发生了变化
        if (detectPageChange()) {
          fillState.pageChangeDetected = true;
          handlePageChange();
        }
      }
    }
    
    // 重置页面变化检测标志
    fillState.pageChangeDetected = false;
  });

  // 开始观察 DOM 变化
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });
  } else {
    // 如果 body 还未加载，等待其加载
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
      });
    });
  }

  // 5. 定期检查页面变化（作为备用机制）
  setInterval(() => {
    if (detectPageChange()) {
      handlePageChange();
    }
  }, 2000);
}

/**
 * @description: 定义内容脚本，处理页面上的自动填充逻辑
 * @function defineContentScript
 * @returns {void} 无返回值
 */
export default defineContentScript({
  matches: ['<all_urls>'], // 匹配所有 URL
  runAt: 'document_start',  // 在DOM加载前运行

  main() {
    logger.info('EasyFill 内容脚本已启动，开始执行填充策略');
    
    // DOM加载前执行首次填充
    executeFirstFill();
    
    // 等待DOM加载完成后执行第二次填充
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        executeSecondFill();
      });
    } else {
      // 如果DOM已经加载完成，立即执行第二次填充
      executeSecondFill();
    }
    
    // 设置高级页面变化检测
    setupAdvancedPageChangeDetection();
    
    logger.info('EasyFill 填充策略已初始化，支持现代页面刷新机制检测');
  }
});