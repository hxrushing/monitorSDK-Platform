import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Space,
  message,
  Popconfirm
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { EventDefinition } from '@/types';

interface EventDefinitionManagerProps {
  projectId: string;
}

const EventDefinitionManager: React.FC<EventDefinitionManagerProps> = ({ projectId }) => {
  const [definitions, setDefinitions] = useState<EventDefinition[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingDefinition, setEditingDefinition] = useState<EventDefinition | null>(null);
  const [form] = Form.useForm();

  const fetchDefinitions = async () => {
    try {
      const response = await fetch(`/api/event-definitions?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        setDefinitions(data.data);
      }
    } catch (error) {
      message.error('获取事件定义失败');
    }
  };

  useEffect(() => {
    fetchDefinitions();
  }, [projectId]);

  const handleCreate = async (values: any) => {
    try {
      const response = await fetch('/api/event-definitions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...values,
          projectId,
          paramsSchema: JSON.parse(values.paramsSchema || '{}'),
        }),
      });

      const data = await response.json();
      if (data.success) {
        message.success('创建成功');
        setIsModalVisible(false);
        form.resetFields();
        fetchDefinitions();
      } else {
        switch (data.code) {
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
            message.error(data.error || '创建失败');
        }
      }
    } catch (error) {
      message.error('创建失败');
    }
  };

  const handleUpdate = async (values: any) => {
    if (!editingDefinition?.id) return;

    try {
      const response = await fetch(`/api/event-definitions/${editingDefinition.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...values,
          projectId,
          paramsSchema: JSON.parse(values.paramsSchema || '{}'),
        }),
      });

      const data = await response.json();
      if (data.success) {
        message.success('更新成功');
        setIsModalVisible(false);
        setEditingDefinition(null);
        form.resetFields();
        fetchDefinitions();
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/event-definitions/${id}?projectId=${projectId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        message.success('删除成功');
        fetchDefinitions();
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '事件名称',
      dataIndex: 'event_name',
      key: 'event_name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '参数定义',
      dataIndex: 'params_schema',
      key: 'params_schema',
      render: (text: string) => <pre>{JSON.stringify(JSON.parse(text), null, 2)}</pre>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: EventDefinition) => (
        <Space>
          <Button
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
            onConfirm={() => handleDelete(record.id!)}
          >
            <Button icon={<DeleteOutlined />} danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="event-definition-manager">
      <div className="header" style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingDefinition(null);
            form.resetFields();
            setIsModalVisible(true);
          }}
        >
          新建事件定义
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={definitions}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingDefinition ? '编辑事件定义' : '新建事件定义'}
        open={isModalVisible}
        onOk={() => form.submit()}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingDefinition(null);
          form.resetFields();
        }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={editingDefinition ? handleUpdate : handleCreate}
        >
          <Form.Item
            name="eventName"
            label="事件名称"
            rules={[{ required: true, message: '请输入事件名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
            rules={[{ required: true, message: '请输入描述' }]}
          >
            <Input.TextArea />
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
                      JSON.parse(value);
                    } catch (error) {
                      throw new Error('参数定义必须是有效的JSON格式');
                    }
                  }
                },
              },
            ]}
          >
            <Input.TextArea rows={6} placeholder="请输入JSON格式的参数定义" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EventDefinitionManager; 