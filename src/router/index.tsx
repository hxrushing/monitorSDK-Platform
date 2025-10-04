// src/router/index.tsx
import { createBrowserRouter } from 'react-router-dom';
import Dashboard from '@/pages/Dashboard';
import EventAnalysis from '@/pages/EventAnalysis';
import FunnelAnalysis from '@/pages/FunnelAnalysis';
import EventManagement from '@/pages/EventManagement';
import Login from '@/pages/login';
import Register from '@/pages/register';
import App from '@/App';
import SDKDemo from '@/pages/sdk-demo';
import SDKModule from '@/pages/SDKModule';
import MemberManagement from '@/pages/MemberManagement';
import SystemSettings from '@/pages/SystemSettings';

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
        path: 'member-management',
        element: <MemberManagement />,
      },
      {
        path: 'sdk-demo',
        element: <SDKDemo />,
      },
      {
        path: 'sdk-module',
        element: <SDKModule />,
      },
      {
        path: 'settings',
        element: <SystemSettings />,
      },
    ],
  },
  {
    path: '/register',
    element: <Register />,
  }
]);

export default router;