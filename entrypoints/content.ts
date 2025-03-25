/**
 * @description: 定义内容脚本，处理页面上的自动填充逻辑。
 * @author: 游钓四方 <haibao1027@gmail.com>
 * @date: 2025-3-24
 */

import { decryptData } from '../utils/cryptoUtils';

// 自动启用输入框的自动完成功能
function handleAutocomplete() {
  // 获取页面上的所有输入框
  const inputs = document.querySelectorAll('input');
  inputs.forEach(input => {
    // 设置每个输入框的 autocomplete 属性为 "on"，以启用浏览器的自动完成功能
    input.setAttribute('autocomplete', 'on');
  });
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

const DEBUG_MODE = false; // 调试开关

// 填充输入框内容
function fillInputFields() {
  // 从 Chrome 的同步存储中获取用户的 name、email 和 url 数据
  chrome.storage.sync.get(['name', 'email', 'url'], async (data) => {
    const name = data.name ? await decryptData(data.name) : '';
    const email = data.email ? await decryptData(data.email) : '';
    const url = data.url ? await decryptData(data.url) : '';

    // 如果昵称和邮箱为空，则不执行填充逻辑
    if (!name || !email) {
      if (DEBUG_MODE) console.warn("[EasyFill] 缺少必填项：昵称或邮箱，跳过填充。");
      return;
    }

    const inputs = document.querySelectorAll("input, textarea");

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

      if (DEBUG_MODE) console.log("[EasyFill]", JSON.stringify(logEntry));

      // 执行填充操作
      if (logEntry.action === "FILL") {
        (input as HTMLInputElement).value = valueToSet;
      }
    });
  });
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
  matches: ['<all_urls>'], // 匹配所有 URL
  runAt: 'document_idle',  // 在页面完全加载后运行

  main() {
    // 页面刚载入时立刻自动填充一次
    handleAutocomplete();
    fillInputFields();

    console.log("[Content Script] EasyFill 自动填充脚本已注入。");

    // 监听 textarea 的输入事件，随时填充
    document.addEventListener("input", (event) => {
      if (event.target instanceof HTMLTextAreaElement) {
        handleAutocomplete(); // 启用自动完成
        fillInputFields();    // 填充输入框
      }
    });
  }
});