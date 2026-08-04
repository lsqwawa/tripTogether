import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, Input, Button, message, Typography } from "antd";
import { tripApi } from "../api";

export default function JoinTrip() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const urlCode = searchParams.get("code");
    if (urlCode) {
      setCode(urlCode.toUpperCase());
    }
  }, [searchParams]);

  const handleJoin = async () => {
    if (!code.trim()) {
      message.warning("请输入邀请码");
      return;
    }
    setLoading(true);
    try {
      const { trip, alreadyMember } = await tripApi.join(
        code.trim().toUpperCase()
      );
      if (alreadyMember) {
        message.info("你已经是这个计划的成员了");
      } else {
        message.success(`已加入「${trip.title}」`);
      }
      navigate(`/trips/${trip.id}`);
    } catch (e: any) {
      const msg = e?.response?.data?.error || "加入失败，请检查邀请码";
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 24 }}>输入邀请码加入旅行 ✈️</h2>
      <Card>
        <Input
          size="large"
          placeholder="输入8位邀请码"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onPressEnter={handleJoin}
          style={{
            textAlign: "center",
            fontSize: 24,
            letterSpacing: 8,
            fontWeight: 700,
          }}
          maxLength={8}
        />
        <Button
          type="primary"
          size="large"
          block
          style={{ marginTop: 16 }}
          loading={loading}
          onClick={handleJoin}
        >
          加入计划
        </Button>
      </Card>
      <Typography.Paragraph
        type="secondary"
        style={{ marginTop: 16, textAlign: "center" }}
      >
        邀请码由计划创建者在计划详情页分享
      </Typography.Paragraph>
    </div>
  );
}
