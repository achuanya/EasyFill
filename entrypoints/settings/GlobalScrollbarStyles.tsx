import React from 'react';
import { GlobalStyles } from '@mui/material';

const GlobalScrollbarStyles: React.FC = () => (
  <GlobalStyles
    styles={{
      '::-webkit-scrollbar': { width: '10px', height: '10px' },
      '::-webkit-scrollbar-thumb': {
        backgroundColor: '#1976d2',
        borderRadius: '6px',
        border: '2px solid #fff',
      },
      '::-webkit-scrollbar-thumb:hover': {
        backgroundColor: '#1565c0',
      },
      '::-webkit-scrollbar-track': {
        backgroundColor: '#f5f5f5',
        borderRadius: '6px',
      },
      '::-webkit-scrollbar-corner': {
        backgroundColor: 'transparent',
      },
    }}
  />
);

export default GlobalScrollbarStyles;
