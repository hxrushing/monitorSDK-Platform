// src/router/index.tsx
import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

// 路由按需加载
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const EventAnalysis = lazy(() => import('@/pages/EventAnalysis'));
const FunnelAnalysis = lazy(() => import('@/pages/FunnelAnalysis'));
const EventManagement = lazy(() => import('@/pages/EventManagement'));
const Login = lazy(() => import('@/pages/login'));
const Register = lazy(() => import('@/pages/register'));
const App = lazy(() => import('@/App'));
const SDKDemo = lazy(() => import('@/pages/sdk-demo'));
const SDKModule = lazy(() => import('@/pages/SDKModule'));
const MemberManagement = lazy(() => import('@/pages/MemberManagement'));
const SystemSettings = lazy(() => import('@/pages/SystemSettings'));
const AISummarySettings = lazy(() => import('@/pages/AISummarySettings'));

const isAuthed = () => !!localStorage.getItem('token') || !!localStorage.getItem('userInfo');

const Protected = ({ children }: { children: JSX.Element }) => {
  if (!isAuthed()) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const withSuspense = (node: JSX.Element) => (
  <Suspense fallback={<div>加载中...</div>}>{node}</Suspense>
);

const router = createBrowserRouter([
  {
    path: '/',
    element: withSuspense(<Login />),
  },
  {
    path: '/login',
    element: withSuspense(<Login />),
  },
  {
    path: '/app',
    element: withSuspense(
      <Protected>
        <App />
      </Protected>
    ),
    children: [
      {
        path: 'dashboard',
        element: withSuspense(<Dashboard />),
      },
      {
        path: 'events',
        element: withSuspense(<EventAnalysis />),
      },
      {
        path: 'funnel',
        element: withSuspense(<FunnelAnalysis />),
      },
      {
        path: 'event-management',
        element: withSuspense(<EventManagement />),
      },
      {
        path: 'member-management',
        element: withSuspense(<MemberManagement />),
      },
      {
        path: 'sdk-demo',
        element: withSuspense(<SDKDemo />),
      },
      {
        path: 'sdk-module',
        element: withSuspense(<SDKModule />),
      },
      {
        path: 'settings',
        element: withSuspense(<SystemSettings />),
      },
      {
        path: 'ai-summary',
        element: withSuspense(<AISummarySettings />),
      },
    ],
  },
  {
    path: '/register',
    element: withSuspense(<Register />),
  }
]);

export default router;