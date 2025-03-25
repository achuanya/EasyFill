import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { marked } from 'marked';

/**
 * MarkdownRenderer 组件属性接口
 * @param content Markdown 文本内容
 */
interface MarkdownRendererProps {
  content: string;
}

/**
 * MarkdownRenderer 组件
 * @description:
 *   将 Markdown 文本解析为 HTML 并渲染到页面。
 *   使用 useMemo 缓存解析结果以提高性能。
 * @author: 游钓四方 <haibao1027@gmail.com>
 * @date: 2025-3-24
 */
const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // 缓存解析后的 HTML
  const htmlContent = useMemo(() => {
    return marked(content); // 使用 marked 库解析 Markdown
  }, [content]);

  return (
    <Box
      sx={{
        maxWidth: '980px',
        margin: '0 auto',
        padding: '0px 32px 0px 32px',
        fontFamily: `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif,
                     "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`,
        fontSize: '16px',
        lineHeight: 1.5,
        color: '#24292e',

        '& h1, & h2, & h3, & h4, & h5, & h6': {
          fontWeight: 600,
          marginTop: '1.5em',
          marginBottom: '0.75em',
          lineHeight: 1.25,
        },
        '& h1': {
          fontSize: '2em',
          borderBottom: '2px solid #eaecef',
          paddingBottom: '0.3em',
        },
        '& h2': {
          fontSize: '1.5em',
          borderBottom: '2px solid #eaecef',
          paddingBottom: '0.3em',
        },
        '& h3': {
          fontSize: '1.25em',
        },
        '& h4': {
          fontSize: '1em',
        },
        '& h5': {
          fontSize: '0.875em',
        },
        '& h6': {
          fontSize: '0.85em',
          color: '#6a737d',
        },

        // 段落与文字
        '& p': {
          margin: '0.5em 0',
        },
        '& a': {
          color: '#0366d6',
          textDecoration: 'none',
          '&:hover': {
            textDecoration: 'underline',
          },
        },

        // 列表
        '& ul, & ol': {
          marginTop: '0.5em',
          marginBottom: '0.5em',
          paddingLeft: '2em',
        },
        '& li': {
          marginBottom: '0.25em',
        },

        // 块引用
        '& blockquote': {
          margin: '0.8em 0',
          padding: '0 1em',
          color: '#6a737d',
          borderLeft: '0.25em solid #dfe2e5',
        },

        // 图片
        '& img': {
          maxWidth: '100%',
          borderRadius: '6px',
          display: 'block',
          margin: '1em auto',
        },

        // 代码
        '& pre': {
          backgroundColor: '#f6f8fa',
          padding: '1rem',
          margin: '1em 0',
          borderRadius: '6px',
          fontSize: '85%',
          lineHeight: 1.45,
          overflow: 'auto',
        },
        '& code': {
          backgroundColor: 'rgba(27,31,35,0.05)',
          padding: '0.2em 0.4em',
          margin: '0 0.1em',
          borderRadius: '3px',
          fontSize: '85%',
        },

        // 表格
        '& table': {
          width: '100%',
          borderCollapse: 'collapse',
          marginBottom: '1em',
        },
        '& th': {
          border: '1px solid #dfe2e5',
          padding: '0.6em 0.8em',
          fontWeight: 600,
          backgroundColor: '#f6f8fa',
        },
        '& td': {
          border: '1px solid #dfe2e5',
          padding: '0.6em 0.8em',
        },
      }}
      dangerouslySetInnerHTML={{ __html: htmlContent }} // 渲染 HTML 内容
    />
  );
};

export default MarkdownRenderer;