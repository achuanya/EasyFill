import React from 'react';
import { Avatar, Box, Typography } from '@mui/material';
import md5 from 'md5';

/**
 * GravatarAvatar 组件属性接口
 * @param name 用户昵称
 * @param email 用户邮箱
 */
interface GravatarAvatarProps {
  name: string;
  email: string;
}

/**
 * GravatarAvatar 组件
 * @description:
 *   根据用户的邮箱生成 Gravatar 头像，并显示用户的昵称和邮箱。
 *   如果邮箱为空，则使用默认头像。
 * @author: 游钓四方 <haibao1027@gmail.com>
 * @date: 2023-10-10
 */
const GravatarAvatar: React.FC<GravatarAvatarProps> = ({ name, email }) => {
  // 生成 Gravatar 头像 URL
  const gravatarUrl = email
    ? `https://www.gravatar.com/avatar/${md5(email.trim().toLowerCase())}?d=mp` // 使用邮箱生成头像
    : 'https://www.gravatar.com/avatar/?d=mp'; // 默认头像

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
      {/* 用户头像 */}
      <Avatar src={gravatarUrl} alt="User Avatar" sx={{ width: 60, height: 60, mr: 2 }} />
      <Box>
        {/* 显示用户昵称 */}
        <Typography variant="h6">{name || '未设置昵称'}</Typography>
        {/* 显示用户邮箱 */}
        <Typography variant="body2" color="text.secondary">{email || '未设置邮箱'}</Typography>
      </Box>
    </Box>
  );
};

export default GravatarAvatar;
