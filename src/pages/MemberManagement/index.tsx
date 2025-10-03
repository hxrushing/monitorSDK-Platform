import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Typography, Table, Tag, Select, message, Result, Spin } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { apiService, UserItem } from '@/services/api';
import useGlobalStore from '@/store/globalStore';

const MemberManagement: React.FC = () => {
  const userInfo = useGlobalStore(state => state.userInfo);
  const isAdmin = userInfo?.role === 'Admin' || (userInfo && !('role' in userInfo) && userInfo.username === 'admin');

  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserItem[]>([]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await apiService.getUsers();
      setUsers(data);
    } catch (e: any) {
      // 控制台输出详细错误
      console.error('获取用户列表失败:', e?.response?.data || e);
      const serverMsg = e?.response?.data?.error || e?.message || '获取用户列表失败';
      message.error(serverMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleChangeRole = async (id: string, role: 'Admin' | 'User') => {
    try {
      await apiService.updateUserRole(id, role);
      message.success('角色更新成功');
      fetchUsers();
    } catch (e: any) {
      console.error('更新角色失败:', e?.response?.data || e);
      const serverMsg = e?.response?.data?.error || e?.message || '更新角色失败';
      message.error(serverMsg);
    }
  };

  const columns: ColumnsType<UserItem> = useMemo(() => [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    { 
      title: '角色', 
      dataIndex: 'role', 
      key: 'role',
      render: (value: UserItem['role'], record) => {
        if (!isAdmin || record.username === 'admin') {
          return <Tag color={value === 'Admin' ? 'green' : 'blue'}>{value}</Tag>;
        }
        return (
          <Select
            value={value}
            style={{ width: 120 }}
            onChange={(v) => handleChangeRole(record.id, v)}
            options={[{ label: 'Admin', value: 'Admin' }, { label: 'User', value: 'User' }]}
          />
        );
      }
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at' },
  ], [isAdmin]);

  if (!isAdmin) {
    return (
      <Result
        status="403"
        title="无权限访问"
        subTitle="该页面仅管理员可访问，请联系管理员或申请提升权限"
      />
    );
  }

  return (
    <div>
      <Typography.Title level={4}>成员管理</Typography.Title>
      <Alert type="info" message="管理员可在此查看用户并调整角色" showIcon style={{ marginBottom: 16 }} />
      <Spin spinning={loading}>
        <Table rowKey="id" columns={columns} dataSource={users} pagination={{ pageSize: 10 }} />
      </Spin>
    </div>
  );
};

export default MemberManagement; 