import React from 'react';
import { createRoot } from 'react-dom/client';
import SettingsPage from './SettingsPage';

/**
 * 应用程序入口文件
 * @description:
 *   渲染 SettingsPage 组件到 HTML 中的 root 节点。
 *   这是整个设置页面的启动点。
 * @author:
 *   游钓四方 <haibao1027@gmail.com>
 * @date: 2023-10-10
 */
const container = document.getElementById('root'); // 获取 root 容器
if (container) {
  const root = createRoot(container); // 创建 React 根节点
  root.render(<SettingsPage />); // 渲染 SettingsPage 组件
}