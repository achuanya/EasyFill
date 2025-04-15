/**
 * @description  微信公众号组件
 * --------------------------------------------------------------------------
 * @author       游钓四方 <haibao1027@gmail.com>
 * @created      2025-04-15
 * @lastModified 2025-04-15
 * --------------------------------------------------------------------------
 * @copyright    (c) 2025 游钓四方
 * @license      MPL-2.0
 * --------------------------------------------------------------------------
 * @module       WeChatOfficialAccount
 */

import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';

interface WeChatOfficialAccountProps {
  imageSrc?: string;
  altText?: string;
}

const WeChatOfficialAccount: React.FC<WeChatOfficialAccountProps> = ({
  imageSrc = '/images/WeChat-Official-Account.jpg',
  altText = '游钓四方的博客'
}) => {
  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      mt: 2,
    }}>
      <Typography 
        variant="body2" 
        color="text.secondary"
        sx={{ mb: 1 }}
      >
      </Typography>
      <Tooltip title="进来看看吧！" placement="top">
        <Box
          sx={{
            maxWidth: '350px',
            borderRadius: '4px',
            overflow: 'hidden',
            transition: 'transform 0.3s ease',
            '&:hover': {
              transform: 'scale(1.02)'
            }
          }}
        >
          <img
            src={imageSrc}
            alt={altText}
            style={{
              maxWidth: '100%',
              height: 'auto',
              objectFit: 'contain',
              display: 'block'
            }}
          />
        </Box>
      </Tooltip>
    </Box>
  );
};

export default WeChatOfficialAccount;