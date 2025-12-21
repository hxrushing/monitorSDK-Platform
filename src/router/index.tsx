// src/router/index.tsx
import { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RouteLoading } from '@/components/Loading';
import RouteErrorBoundary from '@/components/RouteErrorBoundary';

// 路由按需加载
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const EventAnalysis = lazy(() => import('@/pages/EventAnalysis'));
const FunnelAnalysis = lazy(() => import('@/pages/FunnelAnalysis'));
const EventManagement = lazy(() => import('@/pages/EventManagement'));
const Login = lazy(() => import('@/pages/login'));
const Register = lazy(() => import('@/pages/register'));
const App = lazy(() => import('@/App'));
const MemberManagement = lazy(() => import('@/pages/MemberManagement'));
const SystemSettings = lazy(() => import('@/pages/SystemSettings'));
const AISummarySettings = lazy(() => import('@/pages/AISummarySettings'));
const Prediction = lazy(() => import('@/pages/Prediction'));
const PredictionHistory = lazy(() => import('@/pages/PredictionHistory'));
const PerformanceAnalysis = lazy(() => import('@/pages/PerformanceAnalysis'));
const SDKTest = lazy(() => import('@/pages/SDKTest'));

const isAuthed = () => !!localStorage.getItem('token') || !!localStorage.getItem('userInfo');

const Protected = ({ children }: { children: JSX.Element }) => {
  if (!isAuthed()) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const withSuspense = (node: JSX.Element) => (
  <Suspense fallback={<RouteLoading />}>{node}</Suspense>
);

const router = createBrowserRouter([
  {
    path: '/',
    element: withSuspense(<Login />),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/login',
    element: withSuspense(<Login />),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/app',
    element: withSuspense(
      <Protected>
        <App />
      </Protected>
    ),
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: 'dashboard',
        element: withSuspense(<Dashboard />),
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'events',
        element: withSuspense(<EventAnalysis />),
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'funnel',
        element: withSuspense(<FunnelAnalysis />),
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'performance',
        element: withSuspense(<PerformanceAnalysis />),
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'event-management',
        element: withSuspense(<EventManagement />),
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'member-management',
        element: withSuspense(<MemberManagement />),
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'settings',
        element: withSuspense(<SystemSettings />),
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'ai-summary',
        element: withSuspense(<AISummarySettings />),
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'prediction',
        element: withSuspense(<Prediction />),
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'prediction/history',
        element: withSuspense(<PredictionHistory />),
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'sdk-test',
        element: withSuspense(<SDKTest />),
        errorElement: <RouteErrorBoundary />,
      },
    ],
  },
  {
    path: '/register',
    element: withSuspense(<Register />),
    errorElement: <RouteErrorBoundary />,
  }
]);

export default router;