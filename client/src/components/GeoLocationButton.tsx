import { Button } from "antd";
import { EnvironmentOutlined } from "@ant-design/icons";

/** 表单内的「地图选点」按钮：点击前由调用方读取表单坐标作初始中心点 */
export default function GeoLocationButton({ onClick }: { onClick: () => void }) {
  return (
    <Button icon={<EnvironmentOutlined />} onClick={onClick}>
      地图选点
    </Button>
  );
}
