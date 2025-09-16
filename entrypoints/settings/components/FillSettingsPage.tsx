/**
 * @description  填充设置页面组件
 * --------------------------------------------------------------------------
 * @author       游钓四方 <haibao1027@gmail.com>
 * @created      2025-09-16
 * @lastModified 2025-09-16
 * --------------------------------------------------------------------------
 * @copyright    (c) 2025 游钓四方
 * @license      MPL-2.0
 * --------------------------------------------------------------------------
 * @module       FillSettingsPage
 *
 * 功能说明：
 * - 同步设置：管理自动同步开关、同步频率等
 * - 黑名单管理：启用/禁用、官方黑名单、用户自定义黑名单
 * - 关键字源管理：配置关键字数据源URL
 * - 支持批量导入黑名单域名（通过文件上传或拖拽）
 * - 提供完整的填充功能配置界面
 */

import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Switch, FormControlLabel,
  Button, CircularProgress, Divider, Tooltip, TextField,
  IconButton, Snackbar, Alert, Chip, List, ListItem,
  ListItemText, ListItemSecondaryAction, Paper, Link,
  FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore';
import FeedbackIcon from '@mui/icons-material/Feedback';
import { logger } from '../../utils/logger';
import { sendRuntimeMessage } from '../../utils/storageUtils';
import { BlacklistStatus } from '../../utils/blacklistService';

interface SyncStatus {
  lastSync: number;
  nextSync: number;
  syncEnabled: boolean;
  syncInterval: number;
  keywordsUrl: string;
}

const FillSettingsPage: React.FC = () => {
  const [status, setStatus] = useState<BlacklistStatus | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [editingUrl, setEditingUrl] = useState(false);
  
  // Snackbar状态
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'error' | 'info' | 'success' | 'warning'>('info');

  // 加载黑名单状态和同步状态
  useEffect(() => {
    loadBlacklistStatus();
    loadSyncStatus();
  }, []);

  // 加载黑名单状态
  const loadBlacklistStatus = async () => {
    try {
      const response = await sendRuntimeMessage({ action: 'getBlacklistStatus' });
      if (response.success) {
        setStatus(response.data);
      } else {
        showMessage('error', response.error || '获取黑名单状态失败');
      }
    } catch (error) {
      logger.error('加载黑名单状态失败', error);
      showMessage('error', '加载黑名单状态时发生错误');
    }
  };

  // 加载同步状态
  const loadSyncStatus = async () => {
    setLoading(true);
    try {
      const response = await sendRuntimeMessage({ action: 'getSyncStatus' });
      if (response.success) {
        setSyncStatus(response.data);
        setCustomUrl(response.data.keywordsUrl);
      } else {
        showMessage('error', response.error || '获取同步状态失败');
      }
    } catch (error) {
      logger.error('加载同步状态失败', error);
      showMessage('error', '加载同步状态时发生错误');
    } finally {
      setLoading(false);
    }
  };

  // 处理文件上传
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await processFile(file);

    // 清空文件输入
    event.target.value = '';
  };

  // 处理文件内容
  const processFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.txt')) {
      showMessage('error', '请上传txt格式的文件');
      return;
    }

    try {
      const text = await file.text();
      const domains = text
        .split('\n')
        .map(line => line.trim().toLowerCase())
        .filter(line => line && !line.startsWith('#') && !line.startsWith('//'))
        .filter(domain => domain); // 过滤空行和注释行

      if (domains.length === 0) {
        showMessage('warning', '文件中没有找到有效的域名');
        return;
      }

      const currentList = status?.userBlacklist || [];
      const newDomains: string[] = [];
      const duplicates: string[] = [];

      domains.forEach(domain => {
        if (currentList.includes(domain)) {
          duplicates.push(domain);
        } else {
          newDomains.push(domain);
        }
      });

      if (newDomains.length === 0) {
        showMessage('warning', '文件中的所有域名都已存在于黑名单中');
        return;
      }

      const updatedList = [...currentList, ...newDomains];
      await updateSettings({ userBlacklist: updatedList });
      
      let message = `从文件成功导入 ${newDomains.length} 个域名到黑名单`;
      if (duplicates.length > 0) {
        message += `，${duplicates.length} 个域名已存在`;
      }
      showMessage('success', message);
    } catch (error) {
      logger.error('文件上传失败', error);
      showMessage('error', '文件读取失败，请检查文件格式');
    }
  };

  // 处理拖拽事件
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    
    const file = files[0];
    await processFile(file);
  };

  // 显示消息的辅助函数
  const showMessage = (severity: 'error' | 'info' | 'success' | 'warning', message: string) => {
    setSnackbarSeverity(severity);
    setSnackbarMessage(message);
    setOpenSnackbar(true);
  };

  // 更新黑名单设置
  const updateSettings = async (updates: Partial<BlacklistStatus>) => {
    try {
      const response = await sendRuntimeMessage({
        action: 'updateBlacklistSettings',
        settings: updates
      });
      
      if (response.success) {
        setStatus(prev => prev ? { ...prev, ...updates } : null);
        showMessage('success', '黑名单设置已更新');
      } else {
        showMessage('error', response.error || '更新黑名单设置失败');
      }
    } catch (error) {
      logger.error('更新黑名单设置失败', error);
      showMessage('error', '更新黑名单设置时发生错误');
    }
  };

  // 更新同步设置
  const updateSyncSettings = async (updates: Partial<SyncStatus>) => {
    try {
      const response = await sendRuntimeMessage({ 
        action: 'updateSyncSettings',
        settings: updates
      });
      
      if (response.success) {
        setSyncStatus(prev => prev ? { ...prev, ...updates } : null);
        showMessage('success', '同步设置已更新');
      } else {
        showMessage('error', response.error || '更新同步设置失败');
      }
    } catch (error) {
      logger.error('更新同步设置失败', error);
      showMessage('error', '更新同步设置时发生错误');
    }
  };

  // 统一同步功能（同时同步关键字和黑名单）
  const syncAll = async () => {
    setSyncing(true);
    try {
      // 同步关键字数据
      const keywordResponse = await sendRuntimeMessage({ action: 'syncKeywordsNow' });
      
      // 同步官方黑名单
      const blacklistResponse = await sendRuntimeMessage({ action: 'syncOfficialBlacklist' });
      
      const now = Date.now();
      
      if (keywordResponse.success && blacklistResponse.success) {
        // 更新同步状态
        if (syncStatus) {
          setSyncStatus(prev => prev ? {
            ...prev,
            lastSync: now,
            nextSync: now + (prev.syncInterval || 21600000)
          } : null);
        }
        
        // 更新黑名单状态
        setStatus(prev => prev ? {
          ...prev,
          officialBlacklist: blacklistResponse.data.blacklist,
          lastSync: now
        } : null);
        
        showMessage('success', '关键字数据和官方黑名单已成功同步');
      } else {
        const errors = [];
        if (!keywordResponse.success) errors.push('关键字同步失败');
        if (!blacklistResponse.success) errors.push('黑名单同步失败');
        showMessage('error', errors.join('，'));
      }
    } catch (error) {
      logger.error('统一同步失败', error);
      showMessage('error', '同步过程中发生错误');
    } finally {
      setSyncing(false);
    }
  };

  // 重置为默认URL
  const resetToDefaultUrl = () => {
    const defaultUrl = 'https://lhasa-1253887673.cos.ap-shanghai.myqcloud.com/EasyFill/keywords.json';
    setCustomUrl(defaultUrl);
    updateSyncSettings({ keywordsUrl: defaultUrl });
  };

  // 保存自定义URL
  const saveCustomUrl = () => {
    if (customUrl.trim()) {
      updateSyncSettings({ keywordsUrl: customUrl.trim() });
      setEditingUrl(false);
    }
  };

  // 添加用户自定义域名到黑名单（支持批量添加）
  const addUserDomain = async () => {
    if (!newDomain.trim()) {
      showMessage('warning', '请输入有效的域名');
      return;
    }

    // 支持空格分隔的多个域名
    const domains = newDomain.trim().split(/\s+/).map(d => d.toLowerCase()).filter(d => d);
    const currentList = status?.userBlacklist || [];
    const newDomains: string[] = [];
    const duplicates: string[] = [];

    domains.forEach(domain => {
      if (currentList.includes(domain)) {
        duplicates.push(domain);
      } else {
        newDomains.push(domain);
      }
    });

    if (newDomains.length === 0) {
      showMessage('warning', duplicates.length > 0 ? '所有域名都已存在于黑名单中' : '请输入有效的域名');
      return;
    }

    const updatedList = [...currentList, ...newDomains];
    await updateSettings({ userBlacklist: updatedList });
    setNewDomain('');
    
    let message = `成功添加 ${newDomains.length} 个域名到黑名单`;
    if (duplicates.length > 0) {
      message += `，${duplicates.length} 个域名已存在`;
    }
    showMessage('success', message);
  };

  // 删除用户自定义域名从黑名单
  const removeUserDomain = async (domain: string) => {
    const currentList = status?.userBlacklist || [];
    const updatedList = currentList.filter(d => d !== domain);
    
    await updateSettings({ userBlacklist: updatedList });
    showMessage('success', '域名已从黑名单中移除');
  };

  // 格式化日期
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };



  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        p: 3,
        position: 'relative',
        minHeight: '100vh',
        bgcolor: isDragOver ? 'primary.50' : 'transparent',
        transition: 'background-color 0.2s ease-in-out'
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 全局拖拽提示 */}
      {isDragOver && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(25, 118, 210, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            pointerEvents: 'none'
          }}
        >
          <Box
            sx={{
              p: 4,
              bgcolor: 'primary.main',
              color: 'white',
              borderRadius: 2,
              textAlign: 'center',
              boxShadow: 3
            }}
          >
            <Typography variant="h5" sx={{ mb: 1 }}>
              松开鼠标上传txt文件
            </Typography>
            <Typography variant="body2">
              支持黑名单域名文件（每行一个域名，支持#注释）
            </Typography>
          </Box>
        </Box>
      )}
      {/* 同步设置 */}
      <Box>
        <Typography variant="h6" gutterBottom>
          同步设置
          <Tooltip title="自动从服务器获取最新的关键字数据和黑名单，提高填充准确率">
            <IconButton size="small" sx={{ ml: 1 }}>
              <HelpOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Typography>
        
        <Paper sx={{ p: 2 }} elevation={0}>
          <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={syncStatus?.syncEnabled || false}
                    onChange={(e) => updateSyncSettings({ syncEnabled: e.target.checked })}
                  />
                }
                label="启用自动同步"
              />
            </Box>
          <Button
            variant="contained"
            size="small"
            startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            onClick={syncAll}
            disabled={syncing}
            sx={{
              background: 'linear-gradient(to right, #007bff, #00d4ff)',
              '&:hover': {
                backgroundColor: '#0056b3',
              },
            }}
          >
            {syncing ? '同步中...' : '立即同步'}
          </Button>
        </Box>

        <FormControl fullWidth sx={{ mb: 3 }} disabled={!syncStatus?.syncEnabled}>
          <InputLabel>同步频率</InputLabel>
          <Select
            value={syncStatus?.syncInterval || 21600000}
            label="同步频率"
            onChange={(e) => updateSyncSettings({ syncInterval: Number(e.target.value) })}
          >
            <MenuItem value={21600000}>每6小时</MenuItem>
            <MenuItem value={86400000}>每天</MenuItem>
          </Select>
        </FormControl>
      </Paper>
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* 黑名单管理 */}
      <Box>
        <Typography variant="h6" gutterBottom>
          黑名单管理
          <Tooltip title="黑名单功能可以阻止在指定网站上进行自动填充，包括官方维护的黑名单和您自定义的黑名单">
            <IconButton size="small" sx={{ ml: 1 }}>
              <HelpOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Typography>
        
        {/* 黑名单启用开关 */}
        <Paper sx={{ p: 2}} elevation={0}>
          <FormControlLabel
            control={
              <Switch
                checked={status?.blacklistEnabled || false}
                onChange={(e) => updateSettings({ blacklistEnabled: e.target.checked })}
              />
            }
            label="启用黑名单"
          />
        </Paper>
        
        {/* 官方黑名单 */}
        <Paper sx={{ p: 2 }} elevation={0}>
          <Typography variant="subtitle1" gutterBottom>
            官方黑名单 ({status?.officialBlacklist?.length || 0} 个域名)
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            这些域名由官方维护，会定期更新
          </Typography>
          {status?.officialBlacklist && status.officialBlacklist.length > 0 ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Link
                href="https://lhasa-1253887673.cos.ap-shanghai.myqcloud.com/EasyFill/IPblacklist.txt"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
              >
                <OpenInNewIcon sx={{ mr: 0.5, fontSize: 16 }} />
                查看完整黑名单文件
              </Link>
              <Link
                href="https://github.com/achuanya/EasyFill/issues"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
              >
                <FeedbackIcon sx={{ mr: 0.5, fontSize: 16 }} />
                我要分享黑名单
              </Link>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              暂无官方黑名单数据，请点击同步按钮获取最新数据
            </Typography>
          )}
        </Paper>

        {/* 用户自定义黑名单 */}
        <Paper sx={{ p: 2 }} elevation={0}>
          <Typography variant="subtitle1" gutterBottom>
            自定义黑名单 ({status?.userBlacklist?.length || 0} 个域名)
            <Tooltip title="您可以添加自己的黑名单域名，支持通配符（如 *.baidu.com）">
              <IconButton size="small" sx={{ ml: 1 }}>
                <HelpOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Typography>
          {/* 文件上传区域 */}
          <Box 
             sx={{ 
               mb: 2, 
               p: 2, 
               border: '2px dashed', 
               borderColor: isDragOver ? 'primary.main' : 'divider', 
               borderRadius: 1, 
               bgcolor: isDragOver ? 'primary.50' : 'grey.50',
               transition: 'all 0.2s ease-in-out',
               cursor: 'pointer'
             }}
           >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2" color={isDragOver ? 'primary.main' : 'text.secondary'}>
                {isDragOver ? '松开鼠标上传文件' : '批量导入：拖拽或上传txt文件（每行一个域名，支持#注释）'}
              </Typography>
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadFileIcon />}
                size="small"
                sx={{ minWidth: 'auto' }}
              >
                选择文件
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </Button>
            </Box>
          </Box>

          {/* 手动添加区域 */}
          <Box sx={{ display: 'flex', gap: 2, mb: 1, alignItems: 'flex-start' }}>
            <TextField
              size="small"
              label="添加域名"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="输入域名（支持空格分隔多个），如 *.baidu.com *.google.com"
              onKeyPress={(e) => e.key === 'Enter' && addUserDomain()}
              sx={{ flexGrow: 1 }}
              multiline
              maxRows={3}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => addUserDomain()}
              sx={{ background: 'linear-gradient(to right, #007bff, #00d4ff)', alignSelf: 'flex-start', mt: 0.5 }}
              size="small"
            >
              添加
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            支持通配符域名（如 *.baidu.com），可以空格分隔输入多个域名
          </Typography>
          {status?.userBlacklist && status.userBlacklist.length > 0 && (
            <Paper sx={{ p: 2 }} elevation={0}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                 <Typography variant="body2">
                   已添加 {status.userBlacklist.length} 个自定义黑名单域名
                 </Typography>
                 <Box sx={{ display: 'flex', gap: 1 }}>
                   <Button
                     variant="text"
                     size="small"
                     onClick={() => {
                       const content = status.userBlacklist.join('\n');
                       const blob = new Blob([content], { type: 'text/plain' });
                       const url = URL.createObjectURL(blob);
                       const a = document.createElement('a');
                       a.href = url;
                       a.download = 'my-blacklist.txt';
                       a.click();
                       URL.revokeObjectURL(url);
                     }}
                   >
                     导出为txt文件
                   </Button>
                   <Button
                     variant="text"
                     size="small"
                     color="error"
                     onClick={async () => {
                       if (window.confirm('确定要清空所有自定义黑名单域名吗？此操作不可撤销。')) {
                         await updateSettings({ userBlacklist: [] });
                         showMessage('success', '已清空所有自定义黑名单域名');
                       }
                     }}
                   >
                     清空全部
                   </Button>
                 </Box>
               </Box>
              <Box sx={{ maxHeight: 200, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
                 <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                   {status.userBlacklist.map((domain, index) => (
                     <Chip
                       key={index}
                       label={domain}
                       size="small"
                       variant="filled"
                       onDelete={() => removeUserDomain(domain)}
                       deleteIcon={<DeleteIcon fontSize="small" />}
                       sx={{
                         fontFamily: 'monospace',
                         fontSize: '0.75rem',
                         backgroundColor: '#f3f4f6',
                         color: '#374151',
                         border: '1px solid #d1d5db',
                         '&:hover': {
                           backgroundColor: '#e5e7eb',
                           borderColor: '#9ca3af'
                         },
                         '& .MuiChip-deleteIcon': {
                           fontSize: '16px',
                           color: '#6b7280',
                           '&:hover': {
                             color: '#ef4444'
                           }
                         }
                       }}
                     />
                   ))}
                 </Box>
               </Box>
            </Paper>
          )}
        </Paper>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* 关键字源管理 */}
      <Box>
        <Typography variant="h6" gutterBottom>
          关键字源
          <Tooltip title="关键字数据源用于自动填充功能，您可以使用默认数据源或配置自定义数据源">
            <IconButton size="small" sx={{ ml: 1 }}>
              <HelpOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Typography>
        
        <Paper sx={{ p: 2, mb: 3 }} elevation={0}>
          <Typography variant="body2" color="text.secondary" paragraph>
            当前数据源提供自动填充所需的关键字数据
          </Typography>
          
          {editingUrl ? (
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
              <TextField
                fullWidth
                size="small"
                label="自定义URL"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://example.com/keywords.json"
              />
              <Button 
                sx={{ ml: 1 }}
                variant="contained"
                size="small"
                onClick={saveCustomUrl}
                style={{
                  background: 'linear-gradient(to right, #007bff, #00d4ff)',
                }}
              >
                保存
              </Button>
              <Button 
                sx={{ ml: 1 }}
                variant="outlined" 
                size="small"
                onClick={() => {
                  setCustomUrl(syncStatus?.keywordsUrl || '');
                  setEditingUrl(false);
                }}
              >
                取消
              </Button>
            </Box>
          ) : (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    flexGrow: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontFamily: 'monospace',
                    bgcolor: 'grey.100',
                    p: 1,
                    borderRadius: 1
                  }}
                >
                  {syncStatus?.keywordsUrl || '未设置'}
                </Typography>
                <Button 
                  size="small"
                  startIcon={<SettingsBackupRestoreIcon />}
                  onClick={resetToDefaultUrl}
                  sx={{ ml: 1 }}
                >
                  重置
                </Button>
                <Button 
                  size="small"
                  onClick={() => setEditingUrl(true)}
                  sx={{ ml: 1 }}
                >
                  编辑
                </Button>
              </Box>
              {syncStatus?.keywordsUrl && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Link
                    href={syncStatus.keywordsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
                  >
                    <OpenInNewIcon sx={{ mr: 0.5, fontSize: 16 }} />
                    查看关键字源文件
                  </Link>
                  <Link
                    href="https://github.com/achuanya/EasyFill/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
                  >
                    <FeedbackIcon sx={{ mr: 0.5, fontSize: 16 }} />
                    我要分享关键字
                  </Link>
                </Box>
              )}
            </Box>
          )}
        </Paper>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* 同步状态 */}
      <Paper sx={{ p: 2 }} elevation={0}>
        <Typography variant="subtitle1" gutterBottom>同步状态</Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          上次同步: {syncStatus?.lastSync ? formatDate(syncStatus.lastSync) : '从未同步'}
        </Typography>
        {syncStatus?.syncEnabled && syncStatus?.lastSync && (
          <Typography variant="body2" color="text.secondary">
            下次同步: {formatDate(syncStatus.nextSync)}
          </Typography>
        )}
      </Paper>

      {/* Snackbar 提示 */}
      <Snackbar
        open={openSnackbar}
        autoHideDuration={3000}
        onClose={() => setOpenSnackbar(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setOpenSnackbar(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default FillSettingsPage;