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
        
        logger.info('已解密用户数据，准备填充表单');
        
        // 获取页面上的所有输入框和文本区域
        const inputElements = document.querySelectorAll('input, textarea');
        
        let filledCount = 0;
        
        // 遍历所有输入元素
        inputElements.forEach((input: HTMLInputElement | HTMLTextAreaElement) => {
          // 跳过隐藏字段、已填充字段、密码字段和提交按钮
          if (input.type === 'hidden' || 
              input.type === 'password' || 
              input.type === 'submit' || 
              input.type === 'button' ||
              input.value.trim()) {
            return;
          }
          
          const nameAttr = (input.getAttribute("name") || "").toLowerCase();
          const idAttr = (input.getAttribute("id") || "").toLowerCase();
          const placeholderAttr = (input.getAttribute("placeholder") || "").toLowerCase();
          const typeAttr = (input.getAttribute("type") || "").toLowerCase();
          const classAttr = (input.getAttribute("class") || "").toLowerCase();
          
          // 获取表单上下文
          const formContext = getFormContext(input);
          
          // 收集所有可能的属性
          const attributes = [nameAttr, idAttr, placeholderAttr, classAttr];
          
          // 使用智能匹配
          const matchResult = smartMatchKeywords(keywordSets, attributes, {
            enableFuzzy: true,
            enableSubstring: true,
            enableContextual: true,
            formContext
          });
          
          // 根据匹配结果确定要填充的值
          let valueToSet = ""; 
          
          if (matchResult.matched) {
            switch (matchResult.fieldType) {
              case 'name':
                valueToSet = name;
                break;
              case 'email':
                valueToSet = email;
                break;
              case 'url':
                valueToSet = url;
                break;
            }
            
            // 仅当有值要设置时才填充
            if (valueToSet) {
              input.value = valueToSet;
              filledCount++;
              
              // 触发input事件以通知SPA框架数据已改变
              const event = new Event('input', { bubbles: true });
              input.dispatchEvent(event);
              
              logger.info(`已填充 ${matchResult.fieldType} 字段 (${input.name || input.id || 'unnamed'})`, {
                confidence: matchResult.confidence.toFixed(2),
                method: matchResult.method
              });
            }
          } else {
            // 尝试使用input元素的type属性进行匹配
            if (typeAttr === "email" && email) {
              input.value = email;
              filledCount++;
              logger.info(`已通过类型属性填充邮箱字段 (${input.name || input.id || 'unnamed'})`);
            } else if (typeAttr === "url" && url) {
              input.value = url;
              filledCount++;
              logger.info(`已通过类型属性填充URL字段 (${input.name || input.id || 'unnamed'})`);
            }
          }
        });
        
        logger.info(`表单填充完成，共填充了 ${filledCount} 个字段`);
      } catch (error) {
        logger.error('填充表单时发生错误', error);
      }
    });
  } catch (error) {
    logger.error('获取关键字集合失败', error);
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