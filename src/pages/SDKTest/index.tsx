/**
 * SDK测试页面
 * 用于验证可插拔探针SDK各个功能的正确性
 */

import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Input, Select, Divider, Typography, Alert, Tag, List } from 'antd';
import { init } from '../../sdk';
import type { SDKInstance } from '../../sdk';
import { apiService, Project } from '@/services/api';

const { Title, Paragraph, Text } = Typography;

interface TestResult {
  time: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

const SDKTestPage: React.FC = () => {
  const [sdk, setSdk] = useState<SDKInstance | null>(null);
  const [projectId, setProjectId] = useState('demo-project');
  const [projects, setProjects] = useState<Project[]>([]);
  const [endpoint, setEndpoint] = useState('http://localhost:3000/api/track');
  const [results, setResults] = useState<TestResult[]>([]);
  const [queueStatus, setQueueStatus] = useState<any>(null);

  // 获取用户的项目列表并设置默认值
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const projectsList = await apiService.getProjects();
        setProjects(projectsList);
        if (projectsList && projectsList.length > 0) {
          setProjectId(projectsList[0].id);
        }
      } catch (error) {
        console.warn('获取项目列表失败，使用默认项目ID:', error);
      }
    };
    fetchProjects();
  }, []);

  // 添加测试结果
  const addResult = (type: 'success' | 'error' | 'info', message: string) => {
    setResults(prev => [{
      time: new Date().toLocaleTimeString(),
      type,
      message,
    }, ...prev].slice(0, 50)); // 只保留最近50条
  };

  // 初始化SDK
  const handleInit = () => {
    try {
      const instance = init({
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
          ignoreUrls: [],
          maskHeaders: ['Authorization'],
          maskBodyKeys: ['password'],
        },
        behavior: {
          autoPV: false, // 测试页面手动测试
          autoRoute: false,
        },
        debug: true,
      });

      setSdk(instance);
      addResult('success', `SDK初始化成功: ${projectId}`);
    } catch (error: any) {
      addResult('error', `SDK初始化失败: ${error.message}`);
    }
  };

  // 测试自定义事件
  const testTrack = () => {
    if (!sdk) {
      addResult('error', '请先初始化SDK');
      return;
    }
    try {
      sdk.track('test_event', {
        testId: Date.now(),
        message: '这是一个测试事件',
        category: 'test',
      });
      addResult('success', '自定义事件已添加到队列: test_event（将在5秒内自动上报或达到批量大小时立即上报）');
      // 提示用户可以手动刷新
      setTimeout(() => {
        addResult('info', '提示：可以点击"测试 flush()"按钮立即上报队列中的事件');
      }, 1000);
    } catch (error: any) {
      addResult('error', `发送失败: ${error.message}`);
    }
  };

  // 测试错误跟踪
  const testTrackError = () => {
    if (!sdk) {
      addResult('error', '请先初始化SDK');
      return;
    }
    try {
      sdk.trackError('test_error', {
        message: '这是一个测试错误',
        code: 'TEST_001',
        stack: new Error().stack,
      });
      addResult('success', '错误事件已发送: test_error');
    } catch (error: any) {
      addResult('error', `发送失败: ${error.message}`);
    }
  };

  // 测试页面浏览
  const testTrackPage = () => {
    if (!sdk) {
      addResult('error', '请先初始化SDK');
      return;
    }
    try {
      sdk.trackPage('/test/page', {
        title: '测试页面',
        referrer: document.referrer,
      });
      addResult('success', '页面浏览事件已发送: /test/page');
    } catch (error: any) {
      addResult('error', `发送失败: ${error.message}`);
    }
  };

  // 测试HTTP跟踪
  const testTrackHttp = () => {
    if (!sdk) {
      addResult('error', '请先初始化SDK');
      return;
    }
    try {
      sdk.trackHttp({
        url: 'https://api.example.com/test',
        method: 'POST',
        status: 200,
        duration: Math.random() * 1000,
        requestSize: 1024,
        responseSize: 2048,
      });
      addResult('success', 'HTTP事件已发送');
    } catch (error: any) {
      addResult('error', `发送失败: ${error.message}`);
    }
  };

  // 测试性能指标
  const testTrackPerf = () => {
    if (!sdk) {
      addResult('error', '请先初始化SDK');
      return;
    }
    try {
      sdk.trackPerf({
        metric: 'FCP',
        value: 1500,
        rating: 'good',
      });
      addResult('success', '性能指标已发送: FCP');
    } catch (error: any) {
      addResult('error', `发送失败: ${error.message}`);
    }
  };

  // 测试手动刷新
  const testFlush = async () => {
    if (!sdk) {
      addResult('error', '请先初始化SDK');
      return;
    }
    try {
      addResult('info', '正在刷新队列...');
      await sdk.flush();
      addResult('success', '队列已刷新，请查看网络面板确认请求是否发送成功');
    } catch (error: any) {
      addResult('error', `刷新失败: ${error.message}`);
      console.error('Flush错误:', error);
    }
  };

  // 测试触发JS错误（用于验证错误探针）
  const testTriggerError = () => {
    addResult('info', '即将触发一个JS错误...');
    setTimeout(() => {
      // @ts-ignore - 故意触发错误
      undefinedFunction();
    }, 100);
  };

  // 测试触发Promise拒绝（用于验证错误探针）
  const testTriggerPromiseRejection = () => {
    addResult('info', '即将触发一个Promise拒绝...');
    Promise.reject(new Error('测试Promise拒绝'));
  };

  // 测试触发资源加载错误（用于验证错误探针）
  const testTriggerResourceError = () => {
    addResult('info', '即将触发一个资源加载错误...');
    const img = document.createElement('img');
    img.src = 'https://nonexistent-domain-12345.com/test.jpg';
    img.onerror = () => {
      addResult('info', '资源加载错误已触发');
    };
    document.body.appendChild(img);
    setTimeout(() => document.body.removeChild(img), 1000);
  };

  // 批量发送测试
  const testBatchSend = () => {
    if (!sdk) {
      addResult('error', '请先初始化SDK');
      return;
    }
    try {
      for (let i = 0; i < 10; i++) {
        sdk.track('batch_event', {
          index: i,
          timestamp: Date.now(),
        });
      }
      addResult('success', '已发送10个批量事件，将在下次刷新时批量上报');
    } catch (error: any) {
      addResult('error', `批量发送失败: ${error.message}`);
    }
  };

  // 设置用户ID
  const testSetUser = () => {
    if (!sdk) {
      addResult('error', '请先初始化SDK');
      return;
    }
    try {
      const uid = `user_${Date.now()}`;
      sdk.setUser(uid);
      addResult('success', `用户ID已设置: ${uid}`);
    } catch (error: any) {
      addResult('error', `设置失败: ${error.message}`);
    }
  };

  // 检查队列状态（通过localStorage）
  const checkQueueStatus = () => {
    try {
      const key = `analytics_events_${projectId}`;
      const data = localStorage.getItem(key);
      let queueLength = 0;
      try {
        queueLength = data ? JSON.parse(data).length : 0;
      } catch (e) {
        // 解析失败，可能数据格式不对
      }
      
      setQueueStatus({
        queueLength,
        hasOfflineData: queueLength > 0,
        isOnline: navigator.onLine,
      });
      
      addResult('info', `队列状态: ${queueLength}个离线事件, 在线: ${navigator.onLine}`);
    } catch (error: any) {
      addResult('error', `检查失败: ${error.message}`);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <Title level={2}>可插拔探针SDK测试页面</Title>
      <Paragraph>
        此页面用于验证SDK各个功能的正确性，包括API接口、错误探针、批量上报等。
      </Paragraph>

      <Divider>SDK配置</Divider>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>项目:</Text>
            <Select
              value={projectId}
              onChange={(value) => setProjectId(value)}
              style={{ width: '300px', marginLeft: '8px' }}
              placeholder="请选择项目"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={projects.map(project => ({
                label: project.name,
                value: project.id
              }))}
            />
          </div>
          <div>
            <Text strong>上报地址:</Text>
            <Input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              style={{ width: '500px', marginLeft: '8px' }}
            />
          </div>
          <Button type="primary" onClick={handleInit}>
            初始化SDK
          </Button>
          {sdk && <Tag color="green">SDK已初始化</Tag>}
        </Space>
      </Card>

      <Divider>阶段1 (P0) - 核心能力测试</Divider>
      <Card title="API接口测试">
        <Space wrap>
          <Button onClick={testTrack}>测试 track()</Button>
          <Button onClick={testTrackError}>测试 trackError()</Button>
          <Button onClick={testTrackPage}>测试 trackPage()</Button>
          <Button onClick={testTrackHttp}>测试 trackHttp()</Button>
          <Button onClick={testTrackPerf}>测试 trackPerf()</Button>
          <Button onClick={testFlush}>测试 flush()</Button>
          <Button onClick={testSetUser}>测试 setUser()</Button>
        </Space>
      </Card>

      <Card title="批量上报测试">
        <Space wrap>
          <Button onClick={testBatchSend}>批量发送10个事件</Button>
          <Button onClick={checkQueueStatus}>检查队列状态</Button>
        </Space>
        {queueStatus && (
          <div style={{ marginTop: '16px' }}>
            <Text>队列长度: {queueStatus.queueLength}</Text>
            <br />
            <Text>在线状态: {queueStatus.isOnline ? '在线' : '离线'}</Text>
            <br />
            <Text>离线数据: {queueStatus.hasOfflineData ? '有' : '无'}</Text>
          </div>
        )}
      </Card>

      <Divider>阶段2 (P1) - 探针测试</Divider>
      <Card title="错误探针测试">
        <Space wrap>
          <Button danger onClick={testTriggerError}>
            触发JS错误
          </Button>
          <Button danger onClick={testTriggerPromiseRejection}>
            触发Promise拒绝
          </Button>
          <Button danger onClick={testTriggerResourceError}>
            触发资源加载错误
          </Button>
        </Space>
        <Alert
          message="注意"
          description="点击上述按钮会触发真实的错误，这些错误会被错误探针捕获并上报。"
          type="warning"
          showIcon
          style={{ marginTop: '16px' }}
        />
      </Card>

      <Divider>测试结果</Divider>
      <Card>
        <List
          dataSource={results}
          renderItem={(item) => (
            <List.Item>
              <Space>
                <Tag color={item.type === 'success' ? 'green' : item.type === 'error' ? 'red' : 'blue'}>
                  {item.type}
                </Tag>
                <Text type="secondary">[{item.time}]</Text>
                <Text>{item.message}</Text>
              </Space>
            </List.Item>
          )}
          style={{ maxHeight: '400px', overflowY: 'auto' }}
        />
      </Card>

      <Divider>使用说明</Divider>
      <Card>
        <ol>
          <li>配置项目ID（如：demo-project）和上报地址（如：http://localhost:3000/api/track），点击"初始化SDK"</li>
          <li>依次测试各个API接口，观察测试结果</li>
          <li><strong>重要</strong>：事件不会立即发送，而是会：
            <ul>
              <li>添加到队列中等待批量发送</li>
              <li>默认每5秒自动刷新一次</li>
              <li>或达到批量大小（默认50个）时立即发送</li>
              <li>可以点击"测试 flush()"按钮立即发送</li>
            </ul>
          </li>
          <li>打开浏览器开发者工具：
            <ul>
              <li><strong>Console面板</strong>：查看SDK的调试日志（以[SDK]开头）</li>
              <li><strong>Network面板</strong>：查看实际上报请求，过滤"track"关键字</li>
            </ul>
          </li>
          <li>测试错误探针，触发各种错误验证自动捕获</li>
          <li>可以切换到离线模式测试离线缓存功能</li>
        </ol>
        <Alert
          message="调试提示"
          description={
            <div>
              <p>如果事件没有上报，请检查：</p>
              <ul>
                <li>浏览器Console是否有错误信息</li>
                <li>Network面板是否有请求发出（可能被CORS阻止）</li>
                <li>后端服务是否正常运行</li>
                <li>上报地址是否正确</li>
                <li>是否点击了"测试 flush()"按钮立即发送</li>
              </ul>
            </div>
          }
          type="info"
          showIcon
          style={{ marginTop: '16px' }}
        />
      </Card>
    </div>
  );
};

export default SDKTestPage;

