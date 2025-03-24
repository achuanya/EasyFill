import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { marked } from 'marked';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // 使用 useMemo 来缓存渲染的 HTML 内容，只有 content 变化时才会重新渲染
  const htmlContent = useMemo(() => {
    return marked(content);
  }, [content]);

  return (
    <Box
      sx={{
        '& h1': { fontSize: '2rem', fontWeight: 'bold', mb: 2 },
        '& h2': { fontSize: '1.5rem', fontWeight: 'bold', mb: 1.5 },
        '& p': { fontSize: '1rem', lineHeight: 1.6, mb: 1.5 },
        '& a': { color: '#1976d2', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } },
        // 主要修改这部分，图片最大宽度继承父级
        '& img': {
          width: '100%',        // 设置图片宽度为父元素的 100%
          maxWidth: '100%',     // 确保不会超出父容器
          height: 'auto',       // 保持图片比例
          borderRadius: '8px',
          mt: 2,
          display: 'block',
          marginLeft: 'auto',
          marginRight: 'auto',
        },
      }}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};

export default MarkdownRenderer;