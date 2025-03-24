import React, { useState, useEffect, useMemo } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import { AccountCircle, Extension, Info } from '@mui/icons-material';
import { marked } from 'marked';
import GravatarAvatar from './GravatarAvatar';
import UserSettingsPage from './UserSettingsPage';
import MarkdownRenderer from './MarkdownRenderer';
import GlobalScrollbarStyles from './GlobalScrollbarStyles';

/**
 * 整个“设置”界面的根组件
 */
const SettingsPage: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState(0);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [url, setUrl] = useState('');

  const [editing, setEditing] = useState(false);

  const [aboutAuthorContent, setAboutAuthorContent] = useState<string>('');
  const [recommendedPluginsContent, setRecommendedPluginsContent] = useState<string>('');

  // 从chrome.storage读取数据
  useEffect(() => {
    chrome.storage.sync.get(['name', 'email', 'url'], (data) => {
      const storedName = data.name || '';
      const storedEmail = data.email || '';
      const storedUrl = data.url || '';
      setName(storedName);
      setEmail(storedEmail);
      setUrl(storedUrl);

      if (storedName || storedEmail || storedUrl) {
        setEditing(false);
      } else {
        setEditing(true);
      }
    });

    // 通过 useMemo 来缓存 Markdown 内容
    const fetchMarkdown = async (url: string) => {
      try {
        const response = await fetch(url);
        const markdown = await response.text();
        return marked(markdown);
      } catch (error) {
        console.error(`读取 Markdown 文件失败: ${url}`, error);
        return '';
      }
    };

    // 如果之前没有内容，我们就进行加载
    const loadContent = async () => {
      if (!aboutAuthorContent) {
        const aboutAuthor = await fetchMarkdown('/markdowns/about-author.md');
        setAboutAuthorContent(aboutAuthor);
      }

      if (!recommendedPluginsContent) {
        const recommendedPlugins = await fetchMarkdown('/markdowns/recommended-plugins.md');
        setRecommendedPluginsContent(recommendedPlugins);
      }
    };

    loadContent();
  }, [aboutAuthorContent, recommendedPluginsContent]);

  // 点击保存/更改按钮 
  const handleSaveOrChange = () => {
    if (!editing) {
      setEditing(true);
      return;
    }
    if (!name || !email) {
      alert("1111请填写必填字段：昵称和邮箱!");
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      alert("111请输入有效的邮箱地址!");
      return;
    }

    chrome.storage.sync.set({ name, email, url }, () => {
      setEditing(false);
    });
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
  };

  return (
    <>
      <GlobalScrollbarStyles />
      <Box sx={{ display: 'flex' }}>
        <Box sx={{ flex: 1, p: 3, maxWidth: 768, margin: '0 auto' }}>
          <GravatarAvatar name={name} email={email} />
          <Tabs value={selectedTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="我的信息" icon={<AccountCircle />} />
            <Tab label="推荐插件" icon={<Extension />} />
            <Tab label="关于作者" icon={<Info />} />
          </Tabs>

          {/* 我的信息 */}
          {selectedTab === 0 && (
            <UserSettingsPage
              name={name}
              email={email}
              url={url}
              editing={editing}
              onNameChange={(e) => setName(e.target.value)}
              onEmailChange={(e) => setEmail(e.target.value)}
              onUrlChange={(e) => setUrl(e.target.value)}
              onSaveOrChange={handleSaveOrChange}
            />
          )}

          {/* 推荐插件 */}
          {selectedTab === 1 && <MarkdownRenderer content={recommendedPluginsContent} />}

          {/* 关于作者 */}
          {selectedTab === 2 && <MarkdownRenderer content={aboutAuthorContent} />}

          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            mt: 3,
          }}>
            <img
              src="/images/WeChat-Official-Account.jpg"
              alt="游钓四方的博客"
              style={{
                maxWidth: '350px',
                height: 'auto',
                objectFit: 'contain',
              }}
            />
          </Box>
        </Box>
      </Box>
    </>
  );
};

export default SettingsPage;
