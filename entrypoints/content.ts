// 与原 autoFill.js 相同的函数
function handleAutocomplete() {
  const inputs = document.querySelectorAll('input');
  inputs.forEach(input => {
    // 这里可自由修改
    input.setAttribute('autocomplete', 'on');
  });
}

function fillInputFields() {
  // 注意：如果要在这里使用 chrome API，需要安装 @types/chrome
  chrome.storage.sync.get(['name', 'email', 'url'], (data) => {
    const { name, email, url } = data;
    const hasValidName = !!name;
    const hasValidEmail = !!email;
    const hasValidUrl = !!url;

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

      // 针对 type="text" / type="email" / type="url" 等进一步补充逻辑
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

      // 设置值
      if (valueToSet !== "") {
        (input as HTMLInputElement).value = valueToSet;
      }
    });
  });
}

function clearInputFields() {
  const inputs = document.querySelectorAll('input');
  inputs.forEach((input) => {
    const typeAttr = (input.getAttribute("type") || "").toLowerCase();
    if (typeAttr === "text" || typeAttr === "email" || typeAttr === "url") {
      (input as HTMLInputElement).value = "";
    }
  });
}

export default defineContentScript({
  matches: ['<all_urls>'],
  // 让脚本在页面完全加载后执行
  runAt: 'document_idle',

  main() {
    console.log("【Content Script】EasyFill自动填充脚本已注入。");

    // 监听用户对 textarea 的输入，随时尝试自动填充
    document.addEventListener("input", (event) => {
      if (event.target instanceof HTMLTextAreaElement) {
        handleAutocomplete();
        fillInputFields();
      }
    });

    // 也可在页面刚载入时立刻自动填充一次
    handleAutocomplete();
    fillInputFields();
  }
});