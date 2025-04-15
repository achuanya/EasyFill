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
        
        inputs.forEach((input) => {
          const typeAttr = (input.getAttribute("type") || "").toLowerCase();
          const nameAttr = (input.getAttribute("name") || "").toLowerCase();
          const currentValue = input.value;
          let valueToSet = ""; // 初始化要设置的值

          // 根据关键字集合和属性匹配，确定要填充的值
          if (keywordSets.url.has(nameAttr) || (typeAttr === "url" && url)) {
            valueToSet = url || valueToSet;
          } else if (keywordSets.email.has(nameAttr) || (typeAttr === "email" && email)) {
            valueToSet = email || valueToSet;
          } else if (keywordSets.name.has(nameAttr) && name) {
            valueToSet = name || valueToSet;
          }

          // 过滤无关字段
          if (!valueToSet) return;

          // 输出 JSON 格式日志
          const logEntry = {
            name: nameAttr || typeAttr,
            type: typeAttr,
            currentValue,
            valueToSet,
            action: currentValue === valueToSet ? "SKIP" : "FILL",
          };

          // 执行填充操作
          if (logEntry.action === "FILL") {
            logger.info('填充表单字段', JSON.stringify(logEntry));
            (input as HTMLInputElement).value = valueToSet;
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