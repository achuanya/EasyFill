import React, { useState, useEffect, useMemo } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import { AccountCircle, Extension, Info, Article, Chat, Policy } from '@mui/icons-material';
import { marked } from 'marked';
import GravatarAvatar from './GravatarAvatar';
import UserSettingsPage from './UserSettingsPage';
import MarkdownRenderer from './MarkdownRenderer';
import GlobalScrollbarStyles from './GlobalScrollbarStyles';
import { encryptData, decryptData } from '../../utils/cryptoUtils';

/**
 * SettingsPage 组件
 * @description:
 *   整个“设置”界面的根组件，包含用户信息、推荐插件和关于作者三个选项卡。
 *   通过 chrome.storage 同步用户数据，并支持 Markdown 内容的加载和渲染。
 * @author: 游钓四方 <haibao1027@gmail.com>
 * @date: 2025-3-24
 * @param 无
 */
const SettingsPage: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState(0); // 当前选中的选项卡索引

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [url, setUrl] = useState('');

  const [editing, setEditing] = useState(false); // 是否处于编辑模式

  const [aboutAuthorContent, setAboutAuthorContent] = useState<string>(''); // 关于作者的 Markdown 内容
  const [recommendedPluginsContent, setRecommendedPluginsContent] = useState<string>(''); // 推荐插件的 Markdown 内容
  const [updateLogContent, setUpdateLogContent] = useState<string>(''); // 更新日志的 Markdown 内容
  const [privacyPolicyContent, setPrivacyPolicyContent] = useState<string>(''); // 隐私权政策的 Markdown 内容

  // 从 chrome.storage 读取用户数据
  useEffect(() => {
    const loadUserData = async () => {
      chrome.storage.sync.get(['name', 'email', 'url'], async (data) => {
        const storedName = data.name ? await decryptData(data.name) : '';
        const storedEmail = data.email ? await decryptData(data.email) : '';
        const storedUrl = data.url ? await decryptData(data.url) : '';
        setName(storedName);
        setEmail(storedEmail);
        setUrl(storedUrl);

        if (storedName || storedEmail || storedUrl) {
          setEditing(false); // 如果有数据，则默认不处于编辑模式
        } else {
          setEditing(true); // 如果没有数据，则进入编辑模式
        }
      });
    };

    loadUserData(); // 加载用户数据
  }, []); // 移除不必要的依赖项，确保只在组件挂载时调用一次

  useEffect(() => {
    // 加载 Markdown 内容
    const fetchMarkdown = async (url: string) => {
      try {
        const response = await fetch(url);
        const markdown = await response.text();
        return marked(markdown); // 解析 Markdown
      } catch (error) {
        console.error(`读取 Markdown 文件失败: ${url}`, error);
        return '';
      }
    };

    const loadContent = async () => {
      if (!aboutAuthorContent) {
        const aboutAuthor = await fetchMarkdown('/markdowns/about-author.md');
        setAboutAuthorContent(aboutAuthor);
      }

      if (!recommendedPluginsContent) {
        const recommendedPlugins = await fetchMarkdown('/markdowns/recommended-plugins.md');
        setRecommendedPluginsContent(recommendedPlugins);
      }

      if (!updateLogContent) {
        const updateLog = await fetchMarkdown('/markdowns/UpdateLog.md');
        setUpdateLogContent(updateLog);
      }

      if (!privacyPolicyContent) {
        const privacyPolicy = await fetchMarkdown('/markdowns/privacy-policy.md');
        setPrivacyPolicyContent(privacyPolicy);
      }
    };

    loadContent();
  }, [aboutAuthorContent, recommendedPluginsContent, updateLogContent, privacyPolicyContent]);

  const handleSaveOrChange = async () => {
    if (!editing) {
      setEditing(true); // 切换到编辑模式
      return;
    }

    const encryptedName = await encryptData(name);
    const encryptedEmail = await encryptData(email);
    const encryptedUrl = await encryptData(url);

    console.log('加密后的数据:', { encryptedName, encryptedEmail, encryptedUrl });

    chrome.storage.sync.set({ name: encryptedName, email: encryptedEmail, url: encryptedUrl }, () => {
      setEditing(false); // 保存数据后退出编辑模式
    });
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue); // 切换选项卡
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
            <Tab label="更新日志" icon={<Article />} />
            <Tab label="隐私权政策" icon={<Policy />} />
            <Tab
              label="留言"
              icon={<Chat />}
              component="a"
              href="https://lhasa.icu/guestbook.html"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                setSelectedTab(0); // 切换到“我的信息”选项卡
              }}
            />
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

          {/* 更新日志 */}
          {selectedTab === 3 && <MarkdownRenderer content={updateLogContent} />}

          {/* 隐私权政策 */}
          {selectedTab === 4 && <MarkdownRenderer content={privacyPolicyContent} />}

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
