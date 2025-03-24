import React, { useState } from 'react';
import { TextField, Button, Box, Typography, Snackbar } from '@mui/material';
import { Alert } from '@mui/material';

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
 * @date: 2023-10-10
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
   * @date: 2023-10-10
   */
  const handleSaveOrChange = () => {
    // 验证昵称和邮箱是否为空
    if (!name && !email) {
      setSnackbarMessage('请填写必填字段：昵称和邮箱!');
      setSnackbarSeverity('error');
      setOpenSnackbar(true);
      return;
    }

    if (!name) {
      setSnackbarMessage('请填写必填字段：昵称!');
      setSnackbarSeverity('error');
      setOpenSnackbar(true);
      return;
    }

    if (!email) {
      setSnackbarMessage('请填写必填字段：邮箱!');
      setSnackbarSeverity('error');
      setOpenSnackbar(true);
      return;
    }

    // 验证邮箱格式是否正确
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      setSnackbarMessage('请输入有效的邮箱地址!');
      setSnackbarSeverity('error');
      setOpenSnackbar(true);
      return;
    }

    // 保存数据
    onSaveOrChange();
    setSnackbarMessage('保存成功！');
    setSnackbarSeverity('success');
    // 显示 Snackbar
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
