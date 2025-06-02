/**
 * @description  字段匹配系统
 * --------------------------------------------------------------------------
 * @author       游钓四方 <haibao1027@gmail.com>
 * @created      2025-04-13
 * @lastModified 2025-04-13
 * --------------------------------------------------------------------------
 * @copyright    (c) 2025 游钓四方
 * @license      MPL-2.0
 * --------------------------------------------------------------------------
 * @module       entrypoints/content
 */

import { decryptData } from './utils/cryptoUtils';
import { logger } from './utils/logger';
import { getKeywordSets, KeywordSets } from './utils/keywordService';

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
function fillInputFields() {
  try {
    chrome.storage.sync.get(['name', 'email', 'url'], async (data) => {
      if (data.name && data.email && data.url) {
        logger.info('获取到用户数据，开始填充', data);
      } else {
        logger.info('用户数据为空，停止填充', data);
        return;
      }

      let keywordSets: KeywordSets;
      try {
        keywordSets = await getKeywordSets();
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
            let selectors: string[] = [];
            let valueToFill = '';
            
            // 从关键字数据源动态生成选择器
            const keywordSet = keywordSets[fieldType as keyof KeywordSets];
            if (keywordSet) {
              // 为每个关键字生成 placeholder 选择器
              keywordSet.forEach(keyword => {
                // 跳过以 # 开头的关键字（这些已经在主匹配逻辑中处理过了）
                if (!keyword.startsWith('#')) {
                  selectors.push(`input[placeholder*="${keyword}"]`);
                }
              });
              
              // 添加 type 选择器（如果适用）
              if (fieldType === 'email') {
                selectors.push('input[type="email"]');
              } else if (fieldType === 'url') {
                selectors.push('input[type="url"]');
              }
            }
            
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
            
            // 尝试使用生成的选择器填充字段
            for (const selector of selectors) {
              const element = document.querySelector(selector);
              if (element && element instanceof HTMLInputElement && !element.value) {
                element.value = valueToFill;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                additionalFields++;
                logger.info(`使用通用选择器填充字段: ${selector}`, { fieldType, value: valueToFill });
                break; // 找到一个就跳出，避免重复填充
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
    });
  } catch (error) {
    logger.error('获取存储数据时出错', error);
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
    handleAutocomplete();
    fillInputFields();

    // 监听 textarea 的输入事件，随时填充
    document.addEventListener("input", (event) => {
      if (event.target instanceof HTMLTextAreaElement) {
        handleAutocomplete(); // 启用自动完成
        fillInputFields();    // 填充输入框
      }
    });
  }
});