/**
 * @description  全局滚动条样式组件，使用 Material-UI 的 GlobalStyles 来定义滚动条的样式
 * --------------------------------------------------------------------------
 * @author       游钓四方 <haibao1027@gmail.com>
 * @created      2025-04-13
 * @lastModified 2025-04-13
 * --------------------------------------------------------------------------
 * @copyright    (c) 2025 游钓四方
 * @license      MPL-2.0
 * --------------------------------------------------------------------------
 * @module       GlobalScrollbarStyles
 */


import React from 'react';
import { GlobalStyles } from '@mui/material';

/**
 * @description: 全局滚动条样式组件，使用 Material-UI 的 GlobalStyles 来定义滚动条的样式。
 * @function GlobalScrollbarStyles
 * @returns {JSX.Element} 返回一个包含全局滚动条样式的组件。
 */
const GlobalScrollbarStyles: React.FC = () => (
  <GlobalStyles
    styles={{
      // 隐藏滚动条
      '::-webkit-scrollbar': { display: 'none' },
      // 适配其他浏览器的滚动条隐藏
      '*': {
        scrollbarWidth: 'none', // Firefox
        msOverflowStyle: 'none', // IE 10+
      },
    }}
  />
);

export default GlobalScrollbarStyles;
