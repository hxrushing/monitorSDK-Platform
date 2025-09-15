// src/router/index.tsx
import { createBrowserRouter, Navigate } from 'react-router-dom';
import Dashboard from '@/pages/Dashboard';
import EventAnalysis from '@/pages/EventAnalysis';
import FunnelAnalysis from '@/pages/FunnelAnalysis';
import EventManagement from '@/pages/EventManagement';
import Login from '@/pages/login';
import Register from '@/pages/register';
import App from '@/App';
import SDKDemo from '@/pages/sdk-demo';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Login />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/app',
    element: <App />,
    children: [
      {
        path: 'dashboard',
        element: <Dashboard />,
      },
      {
        path: 'events',
        element: <EventAnalysis />,
      },
      {
        path: 'funnel',
        element: <FunnelAnalysis />,
      },
      {
        path: 'event-management',
        element: <EventManagement />,
      },
      {
        path: 'sdk-demo',
        element: <SDKDemo />,
      },
    ],
  },
  {
    path: '/register',
    element: <Register />,
  }
]);

export default router;