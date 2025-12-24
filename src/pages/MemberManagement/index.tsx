import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Typography, Table, Tag, Select, message, Result, Spin, Button, Modal, Checkbox, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SettingOutlined } from '@ant-design/icons';
import { apiService, UserItem, Project } from '@/services/api';
import useGlobalStore from '@/store/globalStore';

const MemberManagement: React.FC = () => {
  const userInfo = useGlobalStore(state => state.userInfo);
  const isAdmin = userInfo?.role === 'Admin' || (userInfo && !('role' in userInfo) && (userInfo as any).username === 'admin');

  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [permissionLoading, setPermissionLoading] = useState(false);

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

  // 打开项目权限管理Modal
  const handleOpenPermissionModal = async (user: UserItem) => {
    try {
      setSelectedUser(user);
      setPermissionModalVisible(true);
      setPermissionLoading(true);

      // 并行获取所有项目和用户的项目权限
      const [allProjectsData, userProjectsData] = await Promise.all([
        apiService.getProjects(),
        apiService.getUserProjectPermissions(user.id)
      ]);

      setAllProjects(allProjectsData);
      setUserProjects(userProjectsData);
      // 设置已选中的项目ID
      setSelectedProjectIds(userProjectsData.map(p => p.id));
    } catch (e: any) {
      console.error('获取项目权限失败:', e?.response?.data || e);
      const serverMsg = e?.response?.data?.error || e?.message || '获取项目权限失败';
      message.error(serverMsg);
      setPermissionModalVisible(false);
    } finally {
      setPermissionLoading(false);
    }
  };

  // 关闭权限管理Modal
  const handleClosePermissionModal = () => {
    setPermissionModalVisible(false);
    setSelectedUser(null);
    setAllProjects([]);
    setUserProjects([]);
    setSelectedProjectIds([]);
  };

  // 切换项目选择
  const handleToggleProject = (projectId: string) => {
    setSelectedProjectIds(prev => {
      if (prev.includes(projectId)) {
        return prev.filter(id => id !== projectId);
      } else {
        return [...prev, projectId];
      }
    });
  };

  // 保存项目权限
  const handleSavePermissions = async () => {
    if (!selectedUser) return;

    try {
      setPermissionLoading(true);
      await apiService.updateUserProjectPermissions(selectedUser.id, selectedProjectIds);
      message.success('项目权限更新成功');
      handleClosePermissionModal();
      // 刷新用户列表（可选）
      // fetchUsers();
    } catch (e: any) {
      console.error('更新项目权限失败:', e?.response?.data || e);
      const serverMsg = e?.response?.data?.error || e?.message || '更新项目权限失败';
      message.error(serverMsg);
    } finally {
      setPermissionLoading(false);
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
    {
      title: '项目权限',
      key: 'permissions',
      width: 120,
      render: (_, record) => {
        // Admin用户不需要项目权限管理
        if (record.role === 'Admin') {
          return <Tag color="green">全部项目</Tag>;
        }
        return (
          <Button
            type="link"
            icon={<SettingOutlined />}
            onClick={() => handleOpenPermissionModal(record)}
            size="small"
          >
            管理权限
          </Button>
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
      <Alert 
        type="info" 
        message="管理员可在此查看用户、调整角色和管理项目权限" 
        showIcon 
        style={{ marginBottom: 16 }} 
      />
      <Spin spinning={loading}>
        <Table rowKey="id" columns={columns} dataSource={users} pagination={{ pageSize: 10 }} />
      </Spin>

      {/* 项目权限管理Modal */}
      <Modal
        title={`管理用户 "${selectedUser?.username}" 的项目权限`}
        open={permissionModalVisible}
        onCancel={handleClosePermissionModal}
        onOk={handleSavePermissions}
        okText="保存"
        cancelText="取消"
        width={600}
        confirmLoading={permissionLoading}
      >
        <Spin spinning={permissionLoading}>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {allProjects.length === 0 ? (
              <Alert message="暂无项目" type="info" />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }}>
                {allProjects.map(project => (
                  <Checkbox
                    key={project.id}
                    checked={selectedProjectIds.includes(project.id)}
                    onChange={() => handleToggleProject(project.id)}
                  >
                    <Space>
                      <span style={{ fontWeight: 500 }}>{project.name}</span>
                      {project.description && (
                        <span style={{ color: '#999', fontSize: '12px' }}>
                          {project.description}
                        </span>
                      )}
                    </Space>
                  </Checkbox>
                ))}
              </Space>
            )}
          </div>
          <div style={{ marginTop: 16, padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
            <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
              已选择 {selectedProjectIds.length} / {allProjects.length} 个项目
            </Typography.Text>
          </div>
        </Spin>
      </Modal>
    </div>
  );
};

export default MemberManagement; 