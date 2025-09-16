/**
 * @description  SettingsPage 入口文件，渲染设置页面的根组件
 * --------------------------------------------------------------------------
 * @author       游钓四方 <haibao1027@gmail.com>
 * @created      2025-04-13
 * @lastModified 2025-09-16
 * --------------------------------------------------------------------------
 * @copyright    (c) 2025 游钓四方
 * @license      MPL-2.0
 * --------------------------------------------------------------------------
 * @module       main
 */


import React from 'react';
import { createRoot } from 'react-dom/client';
import SettingsPage from './components/SettingsPage';
import { logger } from '../utils/logger';

// 配置日志系统根据环境自动启用
logger.configureByEnvironment();

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container); // 创建 React 根节点
  root.render(<SettingsPage />); // 渲染 SettingsPage 组件
}