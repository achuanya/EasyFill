import React, { useState } from 'react';
import { TextField, Button, Box, Typography, Snackbar } from '@mui/material';
import { Alert } from '@mui/material';

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
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'error' | 'info' | 'success' | 'warning'>('error');

  const handleSaveOrChange = () => {
    if (!name || !email) {
      setSnackbarMessage('请填写必填字段：昵称和邮箱!');
      setSnackbarSeverity('error');
      setOpenSnackbar(true);
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      setSnackbarMessage('请输入有效的邮箱地址!');
      setSnackbarSeverity('error');
      setOpenSnackbar(true);
      return;
    }

    // 调用父组件的保存函数
    onSaveOrChange();
    setSnackbarMessage('保存成功！');
    setSnackbarSeverity('success');
    setOpenSnackbar(true);
  };

  return (
    <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
      <Box sx={{ width: '100%', maxWidth: 400 }}>
        <Typography variant="h6" mb={2}>我的信息</Typography>
        {/* 昵称 */}
        <TextField
          label="昵称"
          value={name}
          onChange={onNameChange}
          fullWidth
          margin="normal"
          disabled={!editing}
        />
        {/* 邮箱 */}
        <TextField
          label="邮箱"
          value={email}
          onChange={onEmailChange}
          fullWidth
          margin="normal"
          disabled={!editing}
        />
        {/* 网址 */}
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
      </Box>

      {/* Snackbar 提示 */}
      <Snackbar
        open={openSnackbar}
        autoHideDuration={3000}  // 3秒后自动消失
        onClose={() => setOpenSnackbar(false)}  // 关闭时设置为false
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setOpenSnackbar(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UserSettingsPage;
