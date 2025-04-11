/**
 * @description: 定义内容脚本，处理页面上的自动填充逻辑。
 * @author: 游钓四方 <haibao1027@gmail.com>
 * @date: 2025-3-24
 */

import { decryptData } from '../utils/cryptoUtils';
import { logger } from '../utils/logger';

// 自动启用输入框的自动完成功能
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

// 定义关键字集合，用于匹配输入框的 name 属性
const keywordSets = {
  name: new Set([
    "name", "author", "display_name", "full-name", "username", "nick", "displayname",
    "first-name", "last-name", "real-name", "given-name", "family-name", "alias",
    "display_name", "昵称", "namn"
  ]),
  email: new Set([
    "email", "mail", "contact", "emailaddress", "mailaddress", "useremail", "电子邮件"
  ]),
  url: new Set([
    "url", "link", "website", "homepage", "site", "web", "address", "profile", "网站"
  ])
};

// 填充输入框内容
function fillInputFields() {
  logger.info('开始填充表单信息');
  
  try {
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

// 清空输入框内容
function clearInputFields() {
  const inputs = document.querySelectorAll('input');
  inputs.forEach((input) => {
    const typeAttr = (input.getAttribute("type") || "").toLowerCase();
    if (typeAttr === "text" || typeAttr === "email" || typeAttr === "url") {
      (input as HTMLInputElement).value = "";
    }
  });
}

// 定义内容脚本的入口
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
      logger.info('检测到DOM变化，重新尝试填充表单');
      handleAutocomplete();
      fillInputFields();
    });
    
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
    
    logger.info('表单变化监听器已启动');
  }
});