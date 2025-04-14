/**
 * @description  设置页面组件
 * --------------------------------------------------------------------------
 * @author       游钓四方 <haibao1027@gmail.com>
 * @created      2025-04-13
 * @lastModified 2025-04-13
 * --------------------------------------------------------------------------
 * @copyright    (c) 2025 游钓四方
 * @license      MPL-2.0
 * --------------------------------------------------------------------------
 * @module       SettingsPage
 */


import React, { useState, useEffect, useMemo } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import { AccountCircle, Extension, Info, Article, Chat, Policy, Sync } from '@mui/icons-material';
import { marked } from 'marked';
import GravatarAvatar from './GravatarAvatar';
import UserSettingsPage from './UserSettingsPage';
import SyncSettingsPage from './SyncSettings';
import MarkdownRenderer from './MarkdownRenderer';
import GlobalScrollbarStyles from './GlobalScrollbarStyles';
import { encryptData, decryptData } from '../../utils/cryptoUtils';
import { logger } from '../../utils/logger';

// 设置页面组件
// 该组件用于显示用户的设置选项，包括个人信息、推荐插件、关于作者、更新日志和隐私权政策等
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
      logger.info('开始加载用户数据');
      chrome.storage.sync.get(['name', 'email', 'url'], async (data) => {
        try {
          const storedName = data.name ? await decryptData(data.name) : '';
          const storedEmail = data.email ? await decryptData(data.email) : '';
          const storedUrl = data.url ? await decryptData(data.url) : '';
          
          setName(storedName);
          setEmail(storedEmail);
          setUrl(storedUrl);

          if (storedName || storedEmail || storedUrl) {
            setEditing(false);
            logger.info('用户数据加载成功');
          } else {
            setEditing(true);
            logger.info('未找到用户数据，进入编辑模式');
          }
        } catch (error) {
          logger.error('解密用户数据时出错', error);
          setEditing(true);
        }
      });
    };

    loadUserData();
  }, []);

  useEffect(() => {
    // 加载 Markdown 内容
    const fetchMarkdown = async (url: string) => {
      try {
        // 检查 localStorage 是否已有缓存
        const cachedMarkdown = localStorage.getItem(url);
        if (cachedMarkdown) {
          logger.info(`从缓存加载 Markdown 文件: ${url}`);
          return cachedMarkdown;
        }

        // 如果没有缓存，从网络加载
        logger.info(`从网络加载 Markdown 文件: ${url}`);
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP 错误: ${response.status}`);
        }
        
        const markdown = await response.text();

        // 将加载的内容存入 localStorage
        localStorage.setItem(url, markdown);
        logger.info(`Markdown 文件已缓存: ${url}`);

        return marked(markdown);
      } catch (error) {
        logger.error(`加载 Markdown 文件失败: ${url}`, error);
        return `加载内容失败，请重试。错误: ${error instanceof Error ? error.message : String(error)}`;
      }
    };

    const loadContent = async () => {
      if (!aboutAuthorContent && !recommendedPluginsContent && !updateLogContent && !privacyPolicyContent) {
        const [aboutAuthor, recommendedPlugins, updateLog, privacyPolicy] = await Promise.all([
          fetchMarkdown('/markdowns/about-author.md'),
          fetchMarkdown('/markdowns/recommended-plugins.md'),
          fetchMarkdown('/markdowns/UpdateLog.md'),
          fetchMarkdown('/markdowns/privacy-policy.md'),
        ]);
  
        setAboutAuthorContent(aboutAuthor);
        setRecommendedPluginsContent(recommendedPlugins);
        setUpdateLogContent(updateLog);
        setPrivacyPolicyContent(privacyPolicy);
      }
    };

    loadContent();
  }, []);

  const handleSaveOrChange = async () => {
    if (!editing) {
      logger.info('用户开始编辑个人信息');
      setEditing(true);
      return;
    }

    try {
      logger.info('开始保存用户数据');
      
      // 简单验证
      if (email && !email.includes('@')) {
        logger.warn('用户提供的邮箱格式无效');
        // 你可以在这里添加提示用户的代码
        return;
      }
      
      const encryptedName = await encryptData(name);
      const encryptedEmail = await encryptData(email);
      const encryptedUrl = await encryptData(url);

      chrome.storage.sync.set({ name: encryptedName, email: encryptedEmail, url: encryptedUrl }, () => {
        if (chrome.runtime.lastError) {
          logger.error('保存用户数据时出错', chrome.runtime.lastError);
          return;
        }
        
        setEditing(false);
        logger.info('用户数据保存成功');
      });
    } catch (error) {
      logger.error('加密或保存用户数据时出错', error);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    logger.info(`用户切换到标签: ${newValue}`);
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
            <Tab label="同步设置" icon={<Sync />} />
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

          {/* 同步设置 */}
          {selectedTab === 1 && <SyncSettingsPage />}

          {/* 推荐插件 */}
          {selectedTab === 2 && <MarkdownRenderer content={recommendedPluginsContent} />}

          {/* 关于作者 */}
          {selectedTab === 3 && <MarkdownRenderer content={aboutAuthorContent} />}

          {/* 更新日志 */}
          {selectedTab === 4 && <MarkdownRenderer content={updateLogContent} />}

          {/* 隐私权政策 */}
          {selectedTab === 5 && <MarkdownRenderer content={privacyPolicyContent} />}

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
