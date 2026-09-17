import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input, Button, message, Typography, Segmented } from "antd";
import { UserOutlined, LockOutlined, ArrowRightOutlined } from "@ant-design/icons";
import { useUserStore } from "../stores/userStore";
import BrandMark, { APP_NAME, APP_NAME_EN, APP_TAGLINE } from "../components/BrandMark";

export default function Login() {
  const navigate = useNavigate();
  const register = useUserStore((s) => s.register);
  const login = useUserStore((s) => s.login);
  const loading = useUserStore((s) => s.loading);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async () => {
    const name = nickname.trim();
    if (!name) {
      message.warning("请输入昵称");
      return;
    }
    if (name.length > 20) {
      message.warning("昵称不超过 20 个字符");
      return;
    }
    if (mode === "register" && (!password || password.length < 4)) {
      message.warning("密码至少 4 位");
      return;
    }

    try {
      let user;
      if (mode === "register") {
        user = await register(name, password);
        message.success(`注册成功，欢迎 ${user.nickname}！`);
      } else {
        user = await login(name, password);
        message.success(`欢迎回来，${user.nickname}！`);
      }
      navigate("/");
    } catch (e: any) {
      const msg = e?.response?.data?.error || "操作失败，请重试";
      message.error(msg);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-brand">
          <BrandMark size={52} />
        </div>
        <div className="login-title">{APP_NAME}</div>
        <div className="login-en">{APP_NAME_EN}</div>
        <div className="login-subtitle">{APP_TAGLINE}</div>

        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <Segmented
            value={mode}
            onChange={(v) => setMode(v as "login" | "register")}
            options={[
              { label: "登录", value: "login" },
              { label: "注册", value: "register" },
            ]}
            block
          />
        </div>

        <Input
          size="large"
          prefix={<UserOutlined />}
          placeholder="昵称"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onPressEnter={handleSubmit}
          maxLength={20}
          allowClear
          style={{ marginBottom: 12 }}
        />

        <Input.Password
          size="large"
          prefix={<LockOutlined />}
          placeholder={mode === "register" ? "设置密码（至少4位）" : "密码"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onPressEnter={handleSubmit}
          maxLength={32}
          style={{ marginBottom: 16 }}
        />

        <Button
          type="primary"
          size="large"
          block
          loading={loading}
          onClick={handleSubmit}
          icon={<ArrowRightOutlined />}
        >
          {mode === "register" ? "注册并进入" : "登录"}
        </Button>

        <Typography.Paragraph
          type="secondary"
          style={{
            marginTop: 24,
            textAlign: "center",
            fontSize: 12,
            marginBottom: 0,
          }}
        >
          {mode === "register"
            ? ""
            : "还没账号？点击上方「注册」创建新账号"}
        </Typography.Paragraph>
      </div>
    </div>
  );
}
