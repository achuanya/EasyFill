import React from 'react';
import { Avatar, Box, Typography } from '@mui/material';
import md5 from 'md5';

interface GravatarAvatarProps {
  name: string;
  email: string;
}

const GravatarAvatar: React.FC<GravatarAvatarProps> = ({ name, email }) => {
  // 生成Gravatar头像URL
  const gravatarUrl = email
    ? `https://www.gravatar.com/avatar/${md5(email.trim().toLowerCase())}?d=mp`
    : 'https://www.gravatar.com/avatar/?d=mp';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
      <Avatar src={gravatarUrl} alt="User Avatar" sx={{ width: 60, height: 60, mr: 2 }} />
      <Box>
        <Typography variant="h6">{name || '未设置昵称'}</Typography>
        <Typography variant="body2" color="text.secondary">{email || '未设置邮箱'}</Typography>
      </Box>
    </Box>
  );
};

export default GravatarAvatar;
