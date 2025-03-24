import React from 'react';
import { GlobalStyles } from '@mui/material';

/**
 * @description: 定义全局滚动条样式组件，使用 Material-UI 的 GlobalStyles。
 * @author: 游钓四方 <haibao1027@gmail.com>
 * @date: 2023-10-10
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
