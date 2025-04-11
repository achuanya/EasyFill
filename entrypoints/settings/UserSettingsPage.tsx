import React, { useState } from 'react';
import { TextField, Button, Box, Typography, Snackbar } from '@mui/material';
import { Alert } from '@mui/material';
import { logger } from '../../utils/logger';

/**
 * 用户信息设置页面
 *  - 包含昵称、邮箱、网址的输入框
 *  - 保存/更改 按钮
 *  - Snackbar 提示
 * @param name 昵称
 * @param email 邮箱
 * @param url 网址
 * @param editing 是否处于编辑状态
 * @param onNameChange 昵称输入框变化时的回调
 * @param onEmailChange 邮箱输入框变化时的回调
 * @param onUrlChange 网址输入框变化时的回调
 * @param onSaveOrChange 保存/更改 按钮点击时的回调
 * @returns 用户信息设置页面组件
 */
interface UserSettingsPageProps {
  name: string;
  email: string;
  url: string;
  editing: boolean;
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEmailChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSaveOrChange: () => void;
}

/**
 * 用户信息设置页面组件
 * @description:
 *   该组件用于展示和编辑用户的基本信息，包括昵称、邮箱和网址。
 *   提供保存或更改功能，并通过 Snackbar 提示用户操作结果。
 * @author:
 *   游钓四方 <haibao1027@gmail.com>
 * @date: 2025-3-24
 */
const UserSettingsPage: React.FC<UserSettingsPageProps> = ({
  name,
  email,
  url,
  editing,
  onNameChange,
  onEmailChange,
  onUrlChange,
  onSaveOrChange,
}) => {
  // Snackbar 控制显示
  const [openSnackbar, setOpenSnackbar] = useState(false); // 控制 Snackbar 是否显示
  const [snackbarMessage, setSnackbarMessage] = useState(''); // Snackbar 显示的消息内容
  const [snackbarSeverity, setSnackbarSeverity] = useState<'error' | 'info' | 'success' | 'warning'>('error'); // Snackbar 的类型

  /**
   * 处理保存或更改按钮点击事件
   * @description:
   *   验证用户输入的昵称和邮箱是否有效，并根据结果显示提示信息。
   *   如果验证通过，则调用父组件传递的 onSaveOrChange 方法。
   * @author: 游钓四方 <haibao1027@gmail.com>
   * @date: 2025-3-24
   */
  const handleSaveOrChange = () => {
    logger.info('开始验证用户信息', { name, email, url });
    
    // 定义验证规则
    const validations = [
      {
        isValid: !!name,
        message: '请填写必填字段：昵称!',
        field: 'name'
      },
      {
        isValid: !!email,
        message: '请填写必填字段：邮箱!',
        field: 'email'
      },
      {
        isValid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || ''),
        message: '请输入有效的邮箱地址!',
        field: 'email',
        skipIfEmpty: false // 如果邮箱不为空，跳过此验证（因为前面已经验证了）
      }
    ];

    // 执行验证
    for (const validation of validations) {
      // 如果需要跳过且字段为空，继续下一个验证
      if (validation.skipIfEmpty && !validation[validation.field as keyof typeof validation]) {
        continue;
      }
      
      // 验证失败，显示错误信息
      if (!validation.isValid) {
        logger.warn(`验证失败: ${validation.message}`, { field: validation.field });
        setSnackbarMessage(validation.message);
        setSnackbarSeverity('error');
        setOpenSnackbar(true);
        return; // 早期返回，避免不必要的验证
      }
    }

    // 所有验证通过，保存数据
    logger.info('验证通过，保存用户信息');
    onSaveOrChange();
    setSnackbarMessage('保存成功！');
    setSnackbarSeverity('success');
    setOpenSnackbar(true);
  };

  return (
    <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
      <Box sx={{ width: '100%', maxWidth: 400 }}>
        <Typography variant="h6" mb={2}>我的信息</Typography>
        {/* 昵称输入框 */}
        <TextField
          label="昵称"
          value={name}
          onChange={onNameChange}
          fullWidth
          margin="normal"
          disabled={!editing}
        />
        {/* 邮箱输入框 */}
        <TextField
          label="邮箱"
          value={email}
          onChange={onEmailChange}
          fullWidth
          margin="normal"
          disabled={!editing}
        />
        {/* 网址输入框 */}
        <TextField
          label="网站地址"
          value={url}
          onChange={onUrlChange}
          fullWidth
          margin="normal"
          disabled={!editing}
        />
        {/* 保存/更改 按钮 */}
        <Button
          variant="contained"
          sx={{
            mt: 2,
            background: 'linear-gradient(to right, #007bff, #00d4ff)',
            '&:hover': {
              backgroundColor: '#0056b3',
            },
          }}
          onClick={handleSaveOrChange}
          fullWidth
        >
          {editing ? '保存' : '更改'}
        </Button>

        <Box
          sx={{
            mt: 2,
            p: 2,
            border: '1px dashed #ccc',
            textAlign: 'center',
            color: '#666',
            fontSize: '14px',
            borderRadius: '4px',
          }}
        >
          <Typography variant="body2">广告位招商</Typography>
          <Typography variant="caption">联系邮箱：haibao1027@gmaill.com</Typography>
        </Box>
      </Box>

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

export default UserSettingsPage;
