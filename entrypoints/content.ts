/**
 * @description: 定义内容脚本，处理页面上的自动填充逻辑。
 * @author: 游钓四方 <haibao1027@gmail.com>
 * @date: 2023-10-10
 */

// 自动启用输入框的自动完成功能
function handleAutocomplete() {
  const inputs = document.querySelectorAll('input');
  inputs.forEach(input => {
    input.setAttribute('autocomplete', 'on'); // 设置 autocomplete 属性为 "on"
  });
}

// 自动填充输入框内容
function fillInputFields() {
  chrome.storage.sync.get(['name', 'email', 'url'], (data) => {
    const { name, email, url } = data;
    const hasValidName = !!name;
    const hasValidEmail = !!email;
    const hasValidUrl = !!url;

    // 定义关键字列表，用于匹配输入框的属性名
    const nameKeywords = [
      "name","author","display_name","full-name","username","nick","displayname",
      "first-name","last-name","real-name","given-name","family-name","alias"
    ];
    const emailKeywords = ["email","mail","contact","emailaddress","mailaddress","useremail"];
    const urlKeywords   = ["url","link","website","homepage","site","web","address","profile"];

    const inputs = document.querySelectorAll("input, textarea");

    inputs.forEach((input) => {
      const typeAttr = (input.getAttribute("type") || "").toLowerCase();
      const nameAttr = (input.getAttribute("name") || "").toLowerCase();
      let valueToSet = "";

      // 根据属性名/关键字匹配自动填写
      if (urlKeywords.some(k => nameAttr.includes(k)) && hasValidUrl) {
        valueToSet = url;
      } else if (emailKeywords.some(k => nameAttr.includes(k)) && hasValidEmail) {
        valueToSet = email;
      } else if (nameKeywords.some(k => nameAttr.includes(k)) && hasValidName) {
        valueToSet = name;
      }

      // 根据输入框类型进一步匹配
      if (typeAttr === "email" && valueToSet === "" && hasValidEmail) {
        if (emailKeywords.some(k => nameAttr.includes(k))) {
          valueToSet = email;
        }
      }
      if (typeAttr === "url" && valueToSet === "" && hasValidUrl) {
        if (urlKeywords.some(k => nameAttr.includes(k))) {
          valueToSet = url;
        }
      }

      // 设置匹配到的值
      if (valueToSet !== "") {
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
      (input as HTMLInputElement).value = ""; // 清空输入框的值
    }
  });
}

export default defineContentScript({
  matches: ['<all_urls>'], // 匹配所有 URL
  runAt: 'document_idle',  // 在页面完全加载后运行

  main() {
    console.log("[Content Script] EasyFill 自动填充脚本已注入。"); // 输出日志

    // 监听 textarea 的输入事件，随时填充
    document.addEventListener("input", (event) => {
      if (event.target instanceof HTMLTextAreaElement) {
        handleAutocomplete(); // 启用自动完成
        fillInputFields();    // 填充输入框
      }
    });

    // 页面刚载入时立刻自动填充一次
    handleAutocomplete();
    fillInputFields();
  }
});