/**
 * 可插拔探针SDK测试页面
 * 用于验证各个阶段实现的功能
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Space, Divider, Typography, Alert, Tag, Table, message } from 'antd';
import { init, SDKInstance, SDKCore } from '@/sdk';
import { ErrorProbe } from '@/sdk/probes/error';
import type { ColumnsType } from 'antd/es/table';

const { Title, Paragraph } = Typography;

interface TestResult {
  key: string;
  testName: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  timestamp: string;
}

const PluggableSDKTest: React.FC = () => {
  const [sdk, setSdk] = useState<SDKInstance | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const testResultsRef = useRef<TestResult[]>([]);

  // 初始化SDK
  useEffect(() => {
    try {
      const projectId = localStorage.getItem('selectedProjectId') || 'test-project';
      const endpoint = '/api/track';

      const sdkInstance = init({
        projectId,
        endpoint,
        enable: {
          error: true,
          http: true,
          perf: true,
          behavior: true,
          blankScreen: true,
        },
        sampleRate: {
          perf: 1.0,
          http: 1.0,
          error: 1.0,
          behavior: 1.0,
        },
        http: {
          ignoreUrls: [/\.map$/],
          maskHeaders: ['Authorization'],
        },
        debug: true,
      });

      // 获取SDKCore实例以注册探针
      const coreInstance = SDKCore.getInstance({
        projectId,
        endpoint,
        enable: { error: true },
      });

      // 注册错误探针
      const errorProbe = new ErrorProbe();
      coreInstance.registerProbe(errorProbe);

      setSdk(sdkInstance);
      setIsInitialized(true);

      addTestResult('SDK初始化', 'success', 'SDK初始化成功');
    } catch (error: any) {
      addTestResult('SDK初始化', 'error', `初始化失败: ${error.message}`);
      message.error(`SDK初始化失败: ${error.message}`);
    }
  }, []);

  const addTestResult = (testName: string, status: 'success' | 'error', msg: string) => {
    const result: TestResult = {
      key: Date.now().toString(),
      testName,
      status,
      message: msg,
      timestamp: new Date().toLocaleTimeString(),
    };
    testResultsRef.current = [...testResultsRef.current, result];
    setTestResults([...testResultsRef.current]);
  };

  // 测试1: track API
  const testTrack = () => {
    try {
      if (!sdk) {
        addTestResult('track API', 'error', 'SDK未初始化');
        return;
      }
      sdk.track('test_event', { testKey: 'testValue', timestamp: Date.now() });
      addTestResult('track API', 'success', 'track事件发送成功');
      message.success('track事件已发送');
    } catch (error: any) {
      addTestResult('track API', 'error', error.message);
      message.error(`track失败: ${error.message}`);
    }
  };

  // 测试2: trackError API
  const testTrackError = () => {
    try {
      if (!sdk) {
        addTestResult('trackError API', 'error', 'SDK未初始化');
        return;
      }
      sdk.trackError('test_error', {
        message: '测试错误',
        code: 'TEST_001',
        stack: 'Error: 测试错误\n    at testTrackError',
      });
      addTestResult('trackError API', 'success', '错误事件发送成功');
      message.success('错误事件已发送');
    } catch (error: any) {
      addTestResult('trackError API', 'error', error.message);
      message.error(`trackError失败: ${error.message}`);
    }
  };

  // 测试3: trackPage API
  const testTrackPage = () => {
    try {
      if (!sdk) {
        addTestResult('trackPage API', 'error', 'SDK未初始化');
        return;
      }
      sdk.trackPage('/test-page', { title: '测试页面', referrer: document.referrer });
      addTestResult('trackPage API', 'success', '页面浏览事件发送成功');
      message.success('页面浏览事件已发送');
    } catch (error: any) {
      addTestResult('trackPage API', 'error', error.message);
      message.error(`trackPage失败: ${error.message}`);
    }
  };

  // 测试4: trackHttp API
  const testTrackHttp = () => {
    try {
      if (!sdk) {
        addTestResult('trackHttp API', 'error', 'SDK未初始化');
        return;
      }
      sdk.trackHttp({
        url: '/api/test',
        method: 'GET',
        status: 200,
        duration: 150,
        requestSize: 100,
        responseSize: 500,
      });
      addTestResult('trackHttp API', 'success', 'HTTP事件发送成功');
      message.success('HTTP事件已发送');
    } catch (error: any) {
      addTestResult('trackHttp API', 'error', error.message);
      message.error(`trackHttp失败: ${error.message}`);
    }
  };

  // 测试5: trackPerf API
  const testTrackPerf = () => {
    try {
      if (!sdk) {
        addTestResult('trackPerf API', 'error', 'SDK未初始化');
        return;
      }
      sdk.trackPerf({
        metric: 'FCP',
        value: 1200,
        rating: 'good',
      });
      addTestResult('trackPerf API', 'success', '性能事件发送成功');
      message.success('性能事件已发送');
    } catch (error: any) {
      addTestResult('trackPerf API', 'error', error.message);
      message.error(`trackPerf失败: ${error.message}`);
    }
  };

  // 测试6: flush API
  const testFlush = async () => {
    try {
      if (!sdk) {
        addTestResult('flush API', 'error', 'SDK未初始化');
        return;
      }
      await sdk.flush();
      addTestResult('flush API', 'success', '队列刷新成功');
      message.success('队列已刷新');
    } catch (error: any) {
      addTestResult('flush API', 'error', error.message);
      message.error(`flush失败: ${error.message}`);
    }
  };

  // 测试7: JS Error捕获
  const testJSError = () => {
    try {
      // 触发一个JS错误
      setTimeout(() => {
        // @ts-ignore
        undefinedFunction();
      }, 100);
      addTestResult('JS Error捕获', 'success', '已触发JS错误，应被错误探针捕获');
      message.info('已触发JS错误，请检查控制台和网络请求');
    } catch (error: any) {
      addTestResult('JS Error捕获', 'error', error.message);
    }
  };

  // 测试8: Promise Rejection捕获
  const testPromiseRejection = () => {
    try {
      Promise.reject(new Error('测试Promise拒绝'));
      addTestResult('Promise Rejection捕获', 'success', '已触发Promise rejection，应被错误探针捕获');
      message.info('已触发Promise rejection，请检查网络请求');
    } catch (error: any) {
      addTestResult('Promise Rejection捕获', 'error', error.message);
    }
  };

  // 测试9: 资源加载错误
  const testResourceError = () => {
    try {
      const img = new Image();
      img.src = 'https://invalid-url-test-image-that-does-not-exist.jpg';
      img.onerror = () => {
        addTestResult('资源加载错误捕获', 'success', '已触发资源加载错误');
        message.info('资源加载错误已触发');
      };
    } catch (error: any) {
      addTestResult('资源加载错误捕获', 'error', error.message);
    }
  };

  // 测试10: 批量发送
  const testBatchSend = () => {
    try {
      if (!sdk) {
        addTestResult('批量发送', 'error', 'SDK未初始化');
        return;
      }
      // 发送多个事件
      for (let i = 0; i < 5; i++) {
        sdk.track('batch_event', { index: i, timestamp: Date.now() });
      }
      addTestResult('批量发送', 'success', '已发送5个事件，应批量上报');
      message.success('已发送5个事件');
    } catch (error: any) {
      addTestResult('批量发送', 'error', error.message);
      message.error(`批量发送失败: ${error.message}`);
    }
  };

  // 测试11: setUser API
  const testSetUser = () => {
    try {
      if (!sdk) {
        addTestResult('setUser API', 'error', 'SDK未初始化');
        return;
      }
      sdk.setUser('test-user-' + Date.now());
      addTestResult('setUser API', 'success', '用户ID设置成功');
      message.success('用户ID已设置');
    } catch (error: any) {
      addTestResult('setUser API', 'error', error.message);
      message.error(`setUser失败: ${error.message}`);
    }
  };

  const columns: ColumnsType<TestResult> = [
    {
      title: '测试名称',
      dataIndex: 'testName',
      key: 'testName',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        if (status === 'success') return <Tag color="green">成功</Tag>;
        if (status === 'error') return <Tag color="red">失败</Tag>;
        return <Tag>待测试</Tag>;
      },
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 120,
    },
  ];

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <Card>
        <Title level={2}>可插拔探针SDK功能测试</Title>
        <Paragraph>
          此页面用于验证可插拔探针SDK各个阶段的实现功能。
          请打开浏览器开发者工具的网络面板，查看事件上报情况。
        </Paragraph>

        {!isInitialized && (
          <Alert
            message="SDK正在初始化..."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {isInitialized && (
          <Alert
            message="SDK初始化成功"
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Divider orientation="left">阶段1（P0）核心API测试</Divider>
        <Space wrap style={{ marginBottom: 24 }}>
          <Button type="primary" onClick={testTrack}>
            test track()
          </Button>
          <Button type="primary" onClick={testTrackError}>
            test trackError()
          </Button>
          <Button type="primary" onClick={testTrackPage}>
            test trackPage()
          </Button>
          <Button type="primary" onClick={testTrackHttp}>
            test trackHttp()
          </Button>
          <Button type="primary" onClick={testTrackPerf}>
            test trackPerf()
          </Button>
          <Button onClick={testFlush}>
            test flush()
          </Button>
          <Button onClick={testSetUser}>
            test setUser()
          </Button>
          <Button onClick={testBatchSend}>
            test 批量发送
          </Button>
        </Space>

        <Divider orientation="left">阶段2（P1）错误探针测试</Divider>
        <Space wrap style={{ marginBottom: 24 }}>
          <Button danger onClick={testJSError}>
            触发JS Error
          </Button>
          <Button danger onClick={testPromiseRejection}>
            触发Promise Rejection
          </Button>
          <Button danger onClick={testResourceError}>
            触发资源加载错误
          </Button>
        </Space>

        <Divider orientation="left">测试结果</Divider>
        <Table
          columns={columns}
          dataSource={testResults}
          pagination={{ pageSize: 10 }}
          size="small"
        />

        <Divider orientation="left">使用说明</Divider>
        <Alert
          message="测试提示"
          description={
            <ul>
              <li>点击各个测试按钮，验证对应功能是否正常工作</li>
              <li>打开浏览器开发者工具的Network面板，查看/api/track请求</li>
              <li>打开Console面板，查看SDK的日志输出</li>
              <li>错误探针测试会触发真实的错误，请在控制台查看</li>
              <li>批量发送测试会发送多个事件，观察是否合并为一个请求</li>
            </ul>
          }
          type="info"
          showIcon
        />
      </Card>
    </div>
  );
};

export default PluggableSDKTest;

