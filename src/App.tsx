// src/App.tsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import MainLayout from '@/components/Layout/MainLayout';

const App: React.FC = () => {
  return (
    <MainLayout>
      <Outlet />
    </MainLayout>
  );
};

export default App;