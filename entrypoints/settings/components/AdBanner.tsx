/**
 * @description  广告位招商组件
 * --------------------------------------------------------------------------
 * @author       游钓四方 <haibao1027@gmail.com>
 * @created      2025-04-15
 * @lastModified 2025-04-15
 * --------------------------------------------------------------------------
 * @copyright    (c) 2025 游钓四方
 * @license      MPL-2.0
 * --------------------------------------------------------------------------
 * @module       AdBanner
 */

import React from 'react';
import { Box, Typography, Link } from '@mui/material';

interface AdBannerProps {
  email?: string;
}

const AdBanner: React.FC<AdBannerProps> = ({ 
  email = 'haibao1027@gmail.com' 
}) => {
  return (
    <Box
      sx={{
        mt: 3,
        p: 2,
        border: '1px dashed #ccc',
        textAlign: 'center',
        color: '#666',
        fontSize: '14px',
        borderRadius: '4px',
        maxWidth: '285px',
        mx: 'auto',
        transition: 'all 0.3s ease',
        '&:hover': {
          borderColor: '#aaa',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }
      }}
    >
      <Typography variant="body2">广告位招商</Typography>
      <Typography variant="caption">
        联系邮箱：
        <Link 
          href={`mailto:${email}`} 
          underline="hover"
          color="inherit"
        >
          {email}
        </Link>
      </Typography>
    </Box>
  );
};

export default AdBanner;