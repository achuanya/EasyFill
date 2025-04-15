/**
 * @description  GravatarAvatar 组件，使用 Gravatar 头像服务来显示用户头像
 * --------------------------------------------------------------------------
 * @author       游钓四方 <haibao1027@gmail.com>
 * @created      2025-03-24
 * @lastModified 2025-04-13
 * --------------------------------------------------------------------------
 * @copyright    (c) 2025 游钓四方
 * @license      MPL-2.0
 * --------------------------------------------------------------------------
 * @module       GravatarAvatar
 */


import React from 'react';
import { Avatar, Box, Typography } from '@mui/material';
import md5 from 'md5';

/**
 * @description GravatarAvatarProps 接口
 * @param name 用户昵称
 * @param email 用户邮箱
 */
interface GravatarAvatarProps {
  name: string;
  email: string;
}

/**
 * @description GravatarAvatar 组件
 * @param name 用户昵称
 * @param email 用户邮箱
 * @returns JSX.Element
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
