import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Space,
  message,
  Popconfirm,
  Card,
  Tag,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { apiService } from '@/services/api';
import type { EventDefinition } from '@/types';

const EventManagement: React.FC = () => {
  const [definitions, setDefinitions] = useState<EventDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingDefinition, setEditingDefinition] = useState<EventDefinition | null>(null);
  const [form] = Form.useForm();
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 获取事件定义列表
  const fetchDefinitions = async () => {
    try {
      setLoading(true);
      const data = await apiService.getEventDefinitions('demo-project');
      setDefinitions(data);
    } catch (error) {
      message.error('获取事件定义失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDefinitions();
  }, []);

  // 创建事件定义
  const handleCreate = async (values: any) => {
    try {
      await apiService.createEventDefinition({
        ...values,
        projectId: 'demo-project',
        paramsSchema: typeof values.paramsSchema === 'string' 
          ? JSON.parse(values.paramsSchema)
          : values.paramsSchema
      });
      message.success('创建成功');
      setIsModalVisible(false);
      form.resetFields();
      fetchDefinitions();
    } catch (error: any) {
      const code = error?.response?.data?.code;
      switch (code) {
        case 'INVALID_PARAMS':
          message.error('缺少必要参数');
          break;
        case 'INVALID_EVENT_NAME':
          message.error('事件名称格式不正确');
          break;
        case 'DUPLICATE_EVENT_NAME':
          message.error('事件名称重复');
          break;
        case 'PROJECT_NOT_FOUND':
          message.error('项目不存在');
          break;
        default:
          message.error(error?.response?.data?.error || '创建失败');
      }
    }
  };

  // 更新事件定义
  const handleUpdate = async (values: any) => {
    if (!editingDefinition?.id) return;

    try {
      await apiService.updateEventDefinition(editingDefinition.id, {
        ...values,
        projectId: 'demo-project',
        paramsSchema: typeof values.paramsSchema === 'string'
          ? JSON.parse(values.paramsSchema)
          : values.paramsSchema
      });
      message.success('更新成功');
      setIsModalVisible(false);
      setEditingDefinition(null);
      form.resetFields();
      fetchDefinitions();
    } catch (error) {
      message.error('更新失败');
    }
  };

  // 删除事件定义
  const handleDelete = async (id: string) => {
    try {
      await apiService.deleteEventDefinition(id, 'demo-project');
      message.success('删除成功');
      fetchDefinitions();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '事件名称',
      dataIndex: 'eventName',
      key: 'eventName',
      width: 200,
      render: (text: string) => (
        <Tooltip title={text}>
          <span className="ellipsis">{text}</span>
        </Tooltip>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => (
        <Tooltip title={text}>
          <span className="ellipsis">{text}</span>
        </Tooltip>
      ),
    },
    {
      title: '参数定义',
      dataIndex: 'paramsSchema',
      key: 'paramsSchema',
      width: 300,
      render: (schema: Record<string, any>) => (
        <div className="params-preview">
          {Object.keys(schema).map(key => (
            <Tag key={key} color="blue">
              {key}: {schema[key].type}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: EventDefinition) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingDefinition(record);
              form.setFieldsValue({
                ...record,
                paramsSchema: JSON.stringify(record.paramsSchema, null, 2),
              });
              setIsModalVisible(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个事件定义吗？"
            icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
            onConfirm={() => handleDelete(record.id!)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (page: number, size: number) => {
    setPageSize(size);
  };

  return (
    <div className="event-management">
      <Card
        title="事件管理"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingDefinition(null);
              form.resetFields();
              setIsModalVisible(true);
            }}
          >
            新建事件
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={definitions}
          rowKey="id"
          loading={loading}
          pagination={{
            total: total,
            current: currentPage,
            pageSize: pageSize,
            onChange: handlePageChange,
            onShowSizeChange: handlePageSizeChange,
            showSizeChanger: true,
            pageSizeOptions: ['2', '3', '5', '10'],
            showTotal: (total) => `共 ${total} 条`
          }}
        />
      </Card>

      <Modal
        title={editingDefinition ? '编辑事件' : '新建事件'}
        open={isModalVisible}
        onOk={() => form.submit()}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingDefinition(null);
          form.resetFields();
        }}
        width={720}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={editingDefinition ? handleUpdate : handleCreate}
        >
          <Form.Item
            name="eventName"
            label="事件名称"
            rules={[
              { required: true, message: '请输入事件名称' },
              { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: '事件名称只能包含字母、数字和下划线，且必须以字母开头' }
            ]}
          >
            <Input placeholder="例如：page_view, button_click" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="事件描述"
            rules={[{ required: true, message: '请输入事件描述' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="请详细描述该事件的触发场景和收集目的"
            />
          </Form.Item>

          <Form.Item
            name="paramsSchema"
            label="参数定义"
            rules={[
              { required: true, message: '请输入参数定义' },
              {
                validator: async (_, value) => {
                  if (value) {
                    try {
                      const schema = typeof value === 'string' ? JSON.parse(value) : value;
                      if (typeof schema !== 'object') {
                        throw new Error('参数定义必须是一个对象');
                      }
                    } catch (error) {
                      throw new Error('参数定义必须是有效的JSON格式');
                    }
                  }
                },
              },
            ]}
          >
            <Input.TextArea
              rows={8}
              placeholder={`请输入JSON格式的参数定义，例如：
              {
                "page_url": {
                  "type": "string",
                  "description": "页面URL"
                },
                "duration": {
                  "type": "number",
                  "description": "停留时长（秒）"
                }
              }`}
            />
          </Form.Item>
        </Form>
      </Modal>

      <style>
        {`
          .event-management {
            padding: 24px;
          }
          .ellipsis {
            display: inline-block;
            width: 100%;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .params-preview {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }
        `}
      </style>
    </div>
  );
};

export default EventManagement; 