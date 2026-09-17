import { useState } from "react";
import { Typography, Collapse, Button, Modal, Steps } from "antd";
import { RocketOutlined, ReadOutlined } from "@ant-design/icons";
import { buildGuideSections } from "./guideData";
import { APP_NAME } from "../components/BrandMark";

const { Title, Paragraph } = Typography;

export interface StepModalData {
  title: string;
  steps: { title: string; description: string }[];
}

export default function Guide() {
  const [modalData, setModalData] = useState<StepModalData | null>(null);

  const guideSections = buildGuideSections(setModalData);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <Title level={2}>
          <ReadOutlined style={{ marginRight: 8 }} />
          操作指南手册
        </Title>
        <Paragraph type="secondary" style={{ fontSize: 16 }}>
          从创建计划到行程总览，这里包含了{APP_NAME}每个功能的详细使用说明。
          <br />
          点击各章节下方的「查看详细步骤」按钮，可以逐步查看操作流程。
        </Paragraph>
      </div>

      <Collapse
        defaultActiveKey={["home"]}
        items={guideSections}
        style={{ background: "#fff", borderRadius: 12 }}
      />

      <div style={{ textAlign: "center", marginTop: 32, color: "#999" }}>
        <RocketOutlined style={{ marginRight: 8 }} />
        {APP_NAME} — 让旅行规划更简单
      </div>

      <Modal
        title={modalData?.title}
        open={!!modalData}
        onCancel={() => setModalData(null)}
        footer={[
          <Button key="close" type="primary" onClick={() => setModalData(null)}>
            知道了
          </Button>,
        ]}
        width={640}
      >
        {modalData && (
          <Steps
            direction="vertical"
            size="small"
            progressDot
            current={modalData.steps.length - 1}
            items={modalData.steps.map((s, i) => ({
              title: `${i + 1}. ${s.title}`,
              description: s.description,
            }))}
          />
        )}
      </Modal>
    </div>
  );
}
