import { useState } from "react";
import { Layout, Button, Dropdown, Avatar, Drawer, Tooltip } from "antd";
import {
  Outlet,
  useNavigate,
  useLocation,
  Link,
} from "react-router-dom";
import {
  ReadOutlined,
  UserOutlined,
  LogoutOutlined,
  HomeOutlined,
  PlusOutlined,
  MenuOutlined,
  KeyOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { useUserStore } from "../stores/userStore";
import BrandMark, { APP_NAME, APP_NAME_EN } from "./BrandMark";

const { Header, Content } = Layout;

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUserStore((s) => s.user);
  const logout = useUserStore((s) => s.logout);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const goLogin = () => {
    navigate("/login");
    setDrawerOpen(false);
  };

  const goProfile = () => {
    navigate("/profile");
    setDrawerOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate("/");
    setDrawerOpen(false);
  };

  // 导航项
  const navItems = [
    {
      key: "home",
      label: "我的旅行",
      icon: <HomeOutlined />,
      onClick: () => {
        navigate("/");
        setDrawerOpen(false);
      },
    },
    {
      key: "guide",
      label: "操作指南",
      icon: <ReadOutlined />,
      onClick: () => {
        navigate("/guide");
        setDrawerOpen(false);
      },
    },
    {
      key: "join",
      label: "输入邀请码",
      icon: <KeyOutlined />,
      onClick: () => {
        navigate("/join");
        setDrawerOpen(false);
      },
    },
  ];

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <div className="app-logo" onClick={() => navigate("/")}>
          <BrandMark size={26} />
          <div className="app-logo-text">
            <span className="app-logo-name">{APP_NAME}</span>
            <span className="app-logo-en">{APP_NAME_EN}</span>
          </div>
        </div>

        {/* 桌面端导航 */}
        <div className="app-nav">
          {navItems.map((item) => (
            <div
              key={item.key}
              className={`app-nav-item ${
                isActive(
                  item.key === "home"
                    ? "/"
                    : item.key === "join"
                    ? "/join"
                    : `/${item.key}`
                )
                  ? "active"
                  : ""
              }`}
              onClick={item.onClick}
            >
              {item.icon}
              <span className="desktop-only">{item.label}</span>
            </div>
          ))}

          {user ? (
            <Dropdown
              menu={{
                items: [
                  {
                    key: "profile",
                    icon: <UserOutlined />,
                    label: "个人中心",
                    onClick: goProfile,
                  },
                  { type: "divider" },
                  {
                    key: "logout",
                    icon: <LogoutOutlined />,
                    label: "退出登录",
                    danger: true,
                    onClick: handleLogout,
                  },
                ],
              }}
              placement="bottomRight"
            >
              <div
                className="app-nav-item"
                style={{ cursor: "pointer" }}
              >
                <Avatar
                  size="small"
                  style={{ backgroundColor: "#1677ff" }}
                >
                  {user.nickname?.[0] || "U"}
                </Avatar>
                <span className="desktop-only">{user.nickname}</span>
              </div>
            </Dropdown>
          ) : (
            <Button
              type="primary"
              size="small"
              icon={<UserOutlined />}
              onClick={goLogin}
            >
              登录
            </Button>
          )}
        </div>

        {/* 移动端：用户头像 + 汉堡菜单 */}
        <div
          style={{
            display: "none",
            alignItems: "center",
            gap: 8,
          }}
          className="app-mobile-drawer"
        >
          {user ? (
            <Avatar
              size="small"
              style={{ backgroundColor: "#1677ff", cursor: "pointer" }}
              onClick={goProfile}
            >
              {user.nickname?.[0] || "U"}
            </Avatar>
          ) : (
            <Button
              type="primary"
              size="small"
              onClick={goLogin}
              icon={<UserOutlined />}
            />
          )}
          <button
            className="app-mobile-toggle"
            onClick={() => setDrawerOpen(true)}
            aria-label="打开菜单"
          >
            <MenuOutlined />
          </button>
        </div>
      </Header>

      <Content className="app-content">
        <Outlet />
      </Content>

      {/* 移动端抽屉菜单 */}
      <Drawer
        title={
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>菜单</span>
            <CloseOutlined
              onClick={() => setDrawerOpen(false)}
              style={{ cursor: "pointer" }}
            />
          </div>
        }
        placement="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={280}
      >
        {user && (
          <div
            onClick={goProfile}
            style={{
              padding: "12px 0",
              borderBottom: "1px solid #f0f0f0",
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 12,
              cursor: "pointer",
            }}
          >
            <Avatar
              size={48}
              style={{ backgroundColor: "#1677ff" }}
            >
              {user.nickname?.[0] || "U"}
            </Avatar>
            <div>
              <div style={{ fontWeight: 600 }}>{user.nickname}</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>
                点击进入个人中心
              </div>
            </div>
          </div>
        )}

        {navItems.map((item) => (
          <div
            key={item.key}
            className="app-nav-item"
            style={{
              padding: "12px 8px",
              fontSize: 15,
              borderRadius: 8,
            }}
            onClick={item.onClick}
          >
            {item.icon}
            <span>{item.label}</span>
          </div>
        ))}

        <div
          style={{
            borderTop: "1px solid #f0f0f0",
            marginTop: 16,
            paddingTop: 16,
          }}
        >
          {user ? (
            <div
              className="app-nav-item"
              style={{
                padding: "12px 8px",
                fontSize: 15,
                color: "#ef4444",
              }}
              onClick={handleLogout}
            >
              <LogoutOutlined />
              <span>退出登录</span>
            </div>
          ) : (
            <Button
              type="primary"
              block
              icon={<UserOutlined />}
              onClick={goLogin}
            >
              登录 / 注册
            </Button>
          )}
        </div>
      </Drawer>

      {/* CSS：根据屏幕宽度显示/隐藏 */}
      <style>{`
        @media (max-width: 768px) {
          .app-mobile-drawer {
            display: flex !important;
          }
        }
      `}</style>
    </Layout>
  );
}
