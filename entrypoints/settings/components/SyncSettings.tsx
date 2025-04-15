import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Switch, FormControl, FormControlLabel, 
  Select, MenuItem, Button, CircularProgress, Divider, 
  Tooltip, InputLabel, TextField, IconButton, Snackbar, Alert
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { logger } from '../../utils/logger';

interface SyncStatus {
  lastSync: number;
  nextSync: number;
  syncEnabled: boolean;
  syncInterval: number;
  networkType: 'any' | 'wifi_only';
  keywordsUrl: string;
}

const SyncSettings: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [editingUrl, setEditingUrl] = useState(false);
  
  // 使用Snackbar代替内联Alert，与UserSettingsPage保持一致
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'error' | 'info' | 'success' | 'warning'>('info');

  // 加载同步状态
  useEffect(() => {
    loadSyncStatus();
  }, []);

  // 加载同步状态
  const loadSyncStatus = async () => {
    setLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSyncStatus' });
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

  // 显示消息的辅助函数
  const showMessage = (severity: 'error' | 'info' | 'success' | 'warning', message: string) => {
    setSnackbarSeverity(severity);
    setSnackbarMessage(message);
    setOpenSnackbar(true);
  };

  // 更新同步设置
  const updateSyncSettings = async (updates: Partial<SyncStatus>) => {
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'updateSyncSettings',
        settings: updates
      });
      
      if (response.success) {
        // 只更新本地状态，不再调用loadSyncStatus
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

  // 手动触发同步
  const syncNow = async () => {
    setSyncing(true);
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'syncKeywordsNow' });
      if (response.success) {
        // 只更新最后同步时间，而不是重新加载整个状态
        if (syncStatus) {
          const now = Date.now();
          setSyncStatus(prev => prev ? {
            ...prev,
            lastSync: now,
            nextSync: now + (prev.syncInterval || 21600000)
          } : null);
        }
        showMessage('success', response.data.message || '关键字数据已成功同步');
      } else {
        showMessage('error', response.data?.message || response.error || '同步失败');
      }
    } catch (error) {
      logger.error('手动同步失败', error);
      showMessage('error', '同步过程中发生错误');
    } finally {
      setSyncing(false);
    }
  };

  // 重置为默认URL
  const resetToDefaultUrl = () => {
    const defaultUrl = 'https://cos.lhasa.icu/EasyFill/keywords.json';
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
    <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
      <Box sx={{ width: '100%', maxWidth: 400 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">同步设置</Typography>
          <Button
            variant="contained"
            startIcon={syncing ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
            onClick={syncNow}
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

        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={syncStatus?.syncEnabled || false}
                onChange={(e) => updateSyncSettings({ syncEnabled: e.target.checked })}
              />
            }
            label="启用自动同步"
          />
          
          <Tooltip title="自动从服务器获取最新的关键字数据，提高填充准确率">
            <IconButton size="small" sx={{ ml: 1 }}>
              <HelpOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <FormControl fullWidth sx={{ mb: 3 }} disabled={!syncStatus?.syncEnabled}>
          <InputLabel>同步频率</InputLabel>
          <Select
            value={syncStatus?.syncInterval || 21600000}
            label="同步频率"
            onChange={(e) => updateSyncSettings({ syncInterval: Number(e.target.value) })}
          >
            <MenuItem value={3600000}>每小时</MenuItem>
            <MenuItem value={21600000}>每6小时</MenuItem>
            <MenuItem value={86400000}>每天</MenuItem>
            <MenuItem value={604800000}>每周</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth sx={{ mb: 3 }} disabled={!syncStatus?.syncEnabled}>
          <InputLabel>网络条件</InputLabel>
          <Select
            value={syncStatus?.networkType || 'any'}
            label="网络条件"
            onChange={(e) => updateSyncSettings({ 
              networkType: e.target.value as 'any' | 'wifi_only' 
            })}
          >
            <MenuItem value="any">任何网络</MenuItem>
            <MenuItem value="wifi_only">仅WiFi网络</MenuItem>
          </Select>
        </FormControl>

        <Divider sx={{ my: 3 }} />

        <Typography variant="subtitle1" gutterBottom>关键字数据源</Typography>
        
        {editingUrl ? (
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
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
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
            <Typography 
              variant="body2" 
              sx={{ 
                flexGrow: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
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
        )}

        <Divider sx={{ my: 3 }} />

        <Typography variant="subtitle1" gutterBottom>同步状态</Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          上次同步: {syncStatus?.lastSync ? formatDate(syncStatus.lastSync) : '从未同步'}
        </Typography>
        {syncStatus?.syncEnabled && syncStatus?.lastSync && (
          <Typography variant="body2" color="text.secondary">
            下次同步: {formatDate(syncStatus.nextSync)}
          </Typography>
        )}
      </Box>

      {/* Snackbar 提示，与 UserSettingsPage 保持一致 */}
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

export default SyncSettings;