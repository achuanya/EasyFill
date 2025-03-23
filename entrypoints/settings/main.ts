// 因为此脚本只在 "settings/index.html" 中用到，所以直接写到这里。
// 如果想做多模块拆分，可以再拆成别的 TS 文件，然后在这里 import。

document.addEventListener('DOMContentLoaded', () => {
  // 读取存储并初始化表单
  chrome.storage.sync.get(['name', 'email', 'url'], (data) => {
    (document.getElementById("name") as HTMLInputElement).value = data.name || "";
    (document.getElementById("email") as HTMLInputElement).value = data.email || "";
    (document.getElementById("url") as HTMLInputElement).value = data.url || "";

    // 若已经有数据，就锁定输入框 & 更改按钮文字
    const hasAnyData = data.name || data.email || data.url;
    if (hasAnyData) {
      lockInputFields();
      changeButtonText("更改");
    }
  });

  // 监听菜单点击切换tab
  const menuItems = document.querySelectorAll('.dl-menu li a');
  const tabContents = document.querySelectorAll('.tab-content');
  menuItems.forEach(menuItem => {
    menuItem.addEventListener('click', (event) => {
      event.preventDefault();
      tabContents.forEach(tab => tab.classList.remove('active'));

      const targetId = (menuItem as HTMLAnchorElement).getAttribute('href')!.substring(1);
      document.getElementById(targetId)!.classList.add('active');

      menuItems.forEach(item => item.parentElement!.classList.remove('active'));
      menuItem.parentElement!.classList.add('active');
    });
  });
});

// “保存”/“更改”按钮点击事件
const saveBtn = document.getElementById("save")!;
saveBtn.addEventListener("click", () => {
  const btn = saveBtn as HTMLButtonElement;
  if (btn.textContent === "更改") {
    unlockInputFields();
    changeButtonText("保存");
    return;
  }

  // 拿到用户输入值
  const name = (document.getElementById("name") as HTMLInputElement).value.trim();
  const email = (document.getElementById("email") as HTMLInputElement).value.trim();
  const url = (document.getElementById("url") as HTMLInputElement).value.trim();

  // 验证必填、格式等
  if (!name || !email) {
    alert("请填写必填字段：姓名和邮箱!");
    return;
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    alert("请输入有效的邮箱地址!");
    return;
  }

  // 读取当前存储，与新值对比
  chrome.storage.sync.get(['name', 'email', 'url'], (data) => {
    const isNameOrEmailChanged = (name !== data.name) || (email !== data.email);
    const isUrlChanged = (url !== data.url);

    if (isNameOrEmailChanged || isUrlChanged) {
      chrome.storage.sync.set({ name, email, url }, () => {
        lockInputFields();
        changeButtonText("更改");
      });
    } else {
      lockInputFields();
      changeButtonText("更改");
    }
  });
});

// 工具函数：锁定 & 解锁 表单
function lockInputFields() {
  ["name","email","url"].forEach(id => {
    document.getElementById(id)!.setAttribute("disabled", "true");
  });
}
function unlockInputFields() {
  ["name","email","url"].forEach(id => {
    document.getElementById(id)!.removeAttribute("disabled");
  });
}

// 工具函数：更新按钮文字
function changeButtonText(text: string) {
  document.getElementById("save")!.textContent = text;
}