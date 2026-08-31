import { useState } from "react";
import {
  Modal,
  Avatar,
  Tag,
  Select,
  Popconfirm,
  Button,
  Empty,
  App as AntApp,
} from "antd";
import { DeleteOutlined, CrownOutlined } from "@ant-design/icons";
import type { Trip, TripMember } from "../types";
import { tripApi } from "../api";
import { useUserStore } from "../stores/userStore";

const ROLE_META: Record<string, { label: string; color: string }> = {
  owner: { label: "创建者", color: "blue" },
  editor: { label: "编辑者", color: "green" },
  viewer: { label: "查看者", color: "default" },
};

interface Props {
  trip: Trip;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

// 成员权限管理（1.5）：仅创建者可调整成员角色 / 移除成员
export default function MembersModal({ trip, open, onClose, onUpdated }: Props) {
  const { message } = AntApp.useApp();
  const currentUser = useUserStore((s) => s.user);
  const [busyId, setBusyId] = useState<string | null>(null);

  const members = trip.members || [];
  const isOwner = members.some(
    (m) => m.role === "owner" && m.userId === currentUser?.id
  );

  const changeRole = async (member: TripMember, role: string) => {
    setBusyId(member.id);
    try {
      await tripApi.updateMemberRole(trip.id, member.id, role);
      message.success("角色已更新");
      onUpdated();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "修改失败");
    } finally {
      setBusyId(null);
    }
  };

  const removeMember = async (member: TripMember) => {
    setBusyId(member.id);
    try {
      await tripApi.removeMember(trip.id, member.id);
      message.success("已移除成员");
      onUpdated();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "移除失败");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal
      title="成员管理"
      open={open}
      onCancel={onClose}
      footer={null}
      width={480}
    >
      {!isOwner && (
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>
          仅计划创建者可以调整成员角色或移除成员。
        </div>
      )}
      {members.length === 0 ? (
        <Empty description="暂无成员" />
      ) : (
        members.map((m) => {
          const meta = ROLE_META[m.role] || ROLE_META.viewer;
          const isSelf = m.userId === currentUser?.id;
          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 0",
                borderBottom: "1px solid #f5f5f5",
                flexWrap: "wrap",
              }}
            >
              <Avatar
                style={{
                  backgroundColor: m.role === "owner" ? "#1677ff" : "#87d068",
                }}
              >
                {m.user?.nickname?.[0] || "?"}
              </Avatar>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 500 }}>
                  {m.user?.nickname || "未知"}
                </span>
                {isSelf && (
                  <span style={{ color: "#9ca3af", fontSize: 12 }}>（我）</span>
                )}
              </div>

              {m.role === "owner" ? (
                <Tag color={meta.color} icon={<CrownOutlined />}>
                  {meta.label}
                </Tag>
              ) : isOwner ? (
                <>
                  <Select
                    size="small"
                    value={m.role}
                    style={{ width: 104 }}
                    disabled={busyId === m.id}
                    onChange={(v) => changeRole(m, v)}
                    options={[
                      { value: "editor", label: "编辑者" },
                      { value: "viewer", label: "查看者" },
                    ]}
                  />
                  <Popconfirm
                    title="移除该成员？"
                    description="对方将无法再访问此计划。"
                    onConfirm={() => removeMember(m)}
                    okText="移除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                  >
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      loading={busyId === m.id}
                    />
                  </Popconfirm>
                </>
              ) : (
                <Tag color={meta.color}>{meta.label}</Tag>
              )}
            </div>
          );
        })
      )}
    </Modal>
  );
}
