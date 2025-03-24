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
      // 定义滚动条的宽度和高度
      '::-webkit-scrollbar': { width: '10px', height: '10px' },
      // 定义滚动条滑块的样式
      '::-webkit-scrollbar-thumb': {
        backgroundColor: '#1976d2', // 滑块背景颜色
        borderRadius: '6px',       // 滑块圆角
        border: '2px solid #fff',  // 滑块边框
      },
      // 定义滑块在悬停时的样式
      '::-webkit-scrollbar-thumb:hover': {
        backgroundColor: '#1565c0', // 悬停时的背景颜色
      },
      // 定义滚动条轨道的样式
      '::-webkit-scrollbar-track': {
        backgroundColor: '#f5f5f5', // 轨道背景颜色
        borderRadius: '6px',        // 轨道圆角
      },
      // 定义滚动条拐角的样式
      '::-webkit-scrollbar-corner': {
        backgroundColor: 'transparent', // 拐角背景颜色
      },
    }}
  />
);

export default GlobalScrollbarStyles;
