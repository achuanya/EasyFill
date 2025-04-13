/**
 * @description  自动填充
 * --------------------------------------------------------------------------
 * @author       游钓四方 <haibao1027@gmail.com>
 * @created      2025-04-13
 * @lastModified 2025-04-13
 * --------------------------------------------------------------------------
 * @copyright    (c) 2025 游钓四方
 * @license      MPL-2.0
 * --------------------------------------------------------------------------
 * @module       content
 */


import { decryptData } from '../utils/cryptoUtils';
import { logger } from '../utils/logger';
import { getKeywordSets } from '../utils/keywordService';

/**
 * @description: 启用浏览器的自动完成功能，设置输入框的 autocomplete 属性为 "on"。
 * @function handleAutocomplete
 * @returns {void} 无返回值
 */
function handleAutocomplete() {
  try {
    const inputElements = document.querySelectorAll('input, textarea');
    logger.info(`找到 ${inputElements.length} 个可填充元素`);
    
    // 获取页面上的所有输入框
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
      // 设置每个输入框的 autocomplete 属性为 "on"，以启用浏览器的自动完成功能
      input.setAttribute('autocomplete', 'on');
    });

    logger.info('输入框自动完成功能已启用');
  } catch (error) {
    logger.error('启用自动完成功能时发生错误', error);
  }
}

/**
 * @description: 填充表单信息，使用存储的用户数据填充输入框和文本区域。
 * @function fillInputFields
 * @returns {Promise<void>} 返回一个 Promise，表示填充操作的完成状态。
 */
async function fillInputFields() {
  logger.info('开始填充表单信息');
  
  try {
    // 获取关键字集合
    const keywordSets = await getKeywordSets();

    chrome.storage.sync.get(['name', 'email', 'url'], async (data) => {
      if (!data.name && !data.email && !data.url) {
        logger.warn('未找到用户数据，表单未填充');
        return;
      }
      
      try {
        const name = data.name ? await decryptData(data.name) : '';
        const email = data.email ? await decryptData(data.email) : '';
        const url = data.url ? await decryptData(data.url) : '';
        
        // 如果昵称和邮箱为空，则不执行填充逻辑
        if (!name || !email) {
          logger.warn("缺少必填项：昵称或邮箱，跳过填充");
          return;
        }

        const inputs = document.querySelectorAll("input, textarea");

        let fieldsFound = 0;

        inputs.forEach((input) => {
          const typeAttr = (input.getAttribute("type") || "").toLowerCase();
          const nameAttr = (input.getAttribute("name") || "").toLowerCase();
          const idAttr = (input.getAttribute("id") || "").toLowerCase();
          const placeholderAttr = (input.getAttribute("placeholder") || "").toLowerCase();
          const currentValue = (input as HTMLInputElement).value;

          let valueToSet = ""; // 初始化要设置的值

          // 根据关键字集合和属性匹配，确定要填充的值
          if (matchKeywords(keywordSets.url, [nameAttr, idAttr, placeholderAttr]) || 
              (typeAttr === "url" && url)) {
            valueToSet = url;
          } else if (matchKeywords(keywordSets.email, [nameAttr, idAttr, placeholderAttr]) || 
                     (typeAttr === "email" && email)) {
            valueToSet = email;
          } else if (matchKeywords(keywordSets.name, [nameAttr, idAttr, placeholderAttr]) && 
                    name) {
            valueToSet = name;
          }

          // 过滤无关字段
          if (!valueToSet) return;

          // 输出 JSON 格式日志
          const logEntry = {
            name: nameAttr || idAttr || typeAttr,
            type: typeAttr,
            currentValue,
            valueToSet,
            action: currentValue === valueToSet ? "SKIP" : "FILL",
          };

          // 执行填充操作
          if (logEntry.action === "FILL") {
            logger.info('填充表单字段', JSON.stringify(logEntry));
            (input as HTMLInputElement).value = valueToSet;
            
            // 触发 input 和 change 事件，以便表单验证能够响应
            const inputEvent = new Event('input', { bubbles: true });
            const changeEvent = new Event('change', { bubbles: true });
            input.dispatchEvent(inputEvent);
            input.dispatchEvent(changeEvent);
            
            fieldsFound++;
          }
        });

        logger.info(`表单填充完成，成功填充 ${fieldsFound} 个字段`);
      } catch (error) {
        logger.error('解密或填充表单数据时出错', error);
      }
    });
  } catch (error) {
    logger.error('获取存储数据时出错', error);
  }
}

/**
 * @description: 检查输入框的属性是否与关键字集合匹配。
 * @function matchKeywords
 * @param keywordSet 关键字集合
 * @param attributes 属性集合
 * @return {boolean} 如果匹配则返回 true，否则返回 false
 */
function matchKeywords(keywordSet: Set<string>, attributes: string[]): boolean {
  for (const attr of attributes) {
    if (attr && keywordSet.has(attr)) {
      return true;
    }
  }
  return false;
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',

  main() {
    logger.info('内容脚本已注入页面');
    
    // 延迟执行，确保页面完全加载
    setTimeout(() => {
      handleAutocomplete();
      fillInputFields();
    }, 500);

    // 监听DOM变化，处理动态加载的表单
    const observer = new MutationObserver((mutations) => {
      // 检查是否添加了新的表单元素
      let formElementAdded = false;
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of Array.from(mutation.addedNodes)) {
            if (node instanceof HTMLElement) {
              const inputs = node.querySelectorAll('input, textarea');
              if (inputs.length > 0) {
                formElementAdded = true;
                break;
              }
            }
          }
        }
        
        if (formElementAdded) break;
      }
      
      // 只有添加了新表单元素时才触发填充
      if (formElementAdded) {
        logger.info('检测到新表单元素，尝试填充');
        handleAutocomplete();
        fillInputFields();
      }
    });
    
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
  }
});