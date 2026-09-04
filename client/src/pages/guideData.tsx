import {
  Typography,
  Collapse,
  Tag,
  Card,
  Row,
  Col,
  Button,
  Divider,
  Alert,
  Table,
  Steps,
} from "antd";
import {
  HomeOutlined,
  CalendarOutlined,
  CarOutlined,
  ShopOutlined,
  FileTextOutlined,
  ReadOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  EditOutlined,
  TeamOutlined,
  FlagOutlined,
} from "@ant-design/icons";
import type { StepModalData } from "./Guide";

const { Title, Paragraph, Text } = Typography;

type SetModalData = (d: StepModalData) => void;

/** Guide 页的静态教程数据；外提以把主组件从 818 行降到 ~100 行 */
export function buildGuideSections(setModalData: SetModalData) {
  return [
    {
      key: "home",
      label: (
        <span>
          <HomeOutlined style={{ marginRight: 8 }} />
          首页 & 旅行计划列表
        </span>
      ),
      children: (
        <div>
          <Paragraph>
            首页展示你参与的所有旅行计划。每张卡片包含计划名称、状态标签、日期范围、参与人数和目的地信息。
          </Paragraph>
          <Alert
            type="info"
            showIcon
            message="两个入口"
            description="点击右上角「创建计划」按钮，或在空状态下点击「创建第一个计划」按钮，均可进入创建页面。"
            style={{ marginBottom: 16 }}
          />
          <Card size="small" title="操作要点" style={{ marginBottom: 16 }}>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              <li>点击任意旅行卡片 → 进入该计划的详情页</li>
              <li>点击「创建计划」→ 填写计划信息 → 自动跳转详情页</li>
              <li>点击右上角「输入邀请码」→ 通过邀请码加入别人的计划</li>
            </ul>
          </Card>
          <Button
            type="primary"
            icon={<ReadOutlined />}
            onClick={() =>
              setModalData({
                title: "创建旅行计划 - 详细步骤",
                steps: [
                  {
                    title: "进入创建页面",
                    description:
                      "在首页点击「创建计划」按钮，进入计划创建表单页面。",
                  },
                  {
                    title: "填写计划名称（必填）",
                    description:
                      '输入旅行计划名称，例如「五一游」。这是计划的标识名称。',
                  },
                  {
                    title: "选择旅行日期（必填）",
                    description:
                      "使用日期范围选择器，选择出发日期和返回日期。不能选择过去的日期。系统会根据日期范围自动生成对应天数的日程骨架。",
                  },
                  {
                    title: "填写目的地（选填）",
                    description: "输入目的地信息，例如「北京」。",
                  },
                  {
                    title: "填写计划描述（选填）",
                    description: "简单描述旅行目标和期待，方便旅伴了解行程主题。",
                  },
                  {
                    title: "点击「创建计划」",
                    description:
                      "提交表单后，系统自动：1) 生成每日日程骨架 2) 生成8位邀请码 3) 将你设为计划创建者(owner) 4) 跳转到计划详情页",
                  },
                ],
              })
            }
          >
            查看创建计划详细步骤
          </Button>
        </div>
      ),
    },
    {
      key: "join",
      label: (
        <span>
          <TeamOutlined style={{ marginRight: 8 }} />
          邀请码加入计划
        </span>
      ),
      children: (
        <div>
          <Paragraph>
            通过 8 位邀请码加入别人创建的旅行计划。邀请码由计划创建者在详情页分享。
          </Paragraph>
          <Card size="small" title="操作要点" style={{ marginBottom: 16 }}>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              <li>在首页点击右上角「输入邀请码」进入加入页面</li>
              <li>输入 8 位邀请码（自动转大写）</li>
              <li>点击「加入计划」或直接按回车键</li>
              <li>加入成功后自动跳转到计划详情页</li>
              <li>已加入过的计划会提示「你已经是这个计划的成员了」</li>
              <li>邀请码错误会提示「加入失败，请检查邀请码」</li>
            </ul>
          </Card>
          <Button
            type="primary"
            icon={<ReadOutlined />}
            onClick={() =>
              setModalData({
                title: "邀请码加入计划 - 详细步骤",
                steps: [
                  {
                    title: "获取邀请码",
                    description:
                      "请计划创建者在计划详情页顶部找到邀请码区域，点击复制后分享给你。",
                  },
                  {
                    title: "进入加入页面",
                    description: "在首页右上角点击「输入邀请码」链接，跳转到加入页面。",
                  },
                  {
                    title: "输入邀请码",
                    description:
                      "在输入框中输入 8 位邀请码，系统会自动将字母转为大写。",
                  },
                  {
                    title: "提交加入",
                    description:
                      "点击「加入计划」按钮或直接按回车键提交。系统会自动创建一个匿名用户身份（随机昵称）。",
                  },
                  {
                    title: "进入计划详情",
                    description:
                      "加入成功后自动跳转到该计划的详情页，你可以查看和编辑计划内容。",
                  },
                ],
              })
            }
          >
            查看加入计划详细步骤
          </Button>
        </div>
      ),
    },
    {
      key: "detail",
      label: (
        <span>
          <FlagOutlined style={{ marginRight: 8 }} />
          计划详情页 & 进度看板
        </span>
      ),
      children: (
        <div>
          <Paragraph>
            计划详情页是核心操作页面，分为三个区域：顶部信息栏、进度看板、Tab 内容区。
          </Paragraph>

          <Title level={5}>顶部信息栏</Title>
          <Card size="small" style={{ marginBottom: 16 }}>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              <li>
                <Text strong>返回按钮</Text>：点击返回首页
              </li>
              <li>
                <Text strong>计划标题</Text> + 状态标签（规划中/进行中/已完成）
              </li>
              <li>
                <Text strong>日期范围</Text>：开始日期 ~ 结束日期
              </li>
              <li>
                <Text strong>邀请码</Text>：点击可一键复制到剪贴板，分享给旅伴
              </li>
              <li>
                <Text strong>成员头像组</Text>：显示所有成员，创建者头像为蓝色，其他为绿色
              </li>
            </ul>
          </Card>

          <Title level={5}>进度看板</Title>
          <Paragraph>一目了然展示旅行计划四大环节的规划进度：</Paragraph>
          <Table
            size="small"
            pagination={false}
            style={{ marginBottom: 16 }}
            dataSource={[
              {
                key: 1,
                icon: "🚀",
                name: "出发交通",
                desc: "去程交通安排",
                noData: "待规划",
                hasData: "已预订",
                allDone: "已确认",
              },
              {
                key: 2,
                icon: "🏨",
                name: "住宿安排",
                desc: "住宿信息",
                noData: "待规划",
                hasData: "已预订",
                allDone: "已确认",
              },
              {
                key: 3,
                icon: "📅",
                name: "每日日程",
                desc: "每天的行程安排",
                noData: "待规划",
                hasData: "已预订",
                allDone: "已确认",
              },
              {
                key: 4,
                icon: "🏠",
                name: "返程交通",
                desc: "回程交通安排",
                noData: "待规划",
                hasData: "已预订",
                allDone: "已确认",
              },
            ]}
            columns={[
              { title: "图标", dataIndex: "icon", width: 60 },
              { title: "环节", dataIndex: "name", width: 100 },
              { title: "含义", dataIndex: "desc", width: 120 },
              { title: "无数据", dataIndex: "noData", width: 80 },
              { title: "有数据", dataIndex: "hasData", width: 80 },
              { title: "全部完成", dataIndex: "allDone", width: 80 },
            ]}
          />
          <Alert
            type="info"
            showIcon
            message="状态标签颜色"
            description="灰色 = 待规划 | 蓝色 = 已预订 | 绿色 = 已确认"
            style={{ marginBottom: 16 }}
          />
        </div>
      ),
    },
    {
      key: "schedule",
      label: (
        <span>
          <CalendarOutlined style={{ marginRight: 8 }} />
          每日日程管理
        </span>
      ),
      children: (
        <div>
          <Paragraph>
            按天管理详细的行程安排，是规划每天去哪、吃什么、玩什么的核心区域。每天一个卡片，按天数排列。
          </Paragraph>

          <Title level={5}>日程项类型</Title>
          <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
            {[
              { icon: "🍜", label: "美食" },
              { icon: "🏛️", label: "景点" },
              { icon: "🎯", label: "活动" },
              { icon: "🚗", label: "交通" },
              { icon: "😴", label: "休息" },
            ].map((item) => (
              <Col key={item.label}>
                <Tag style={{ fontSize: 14, padding: "4px 12px" }}>
                  {item.icon} {item.label}
                </Tag>
              </Col>
            ))}
          </Row>

          <Title level={5}>日程项字段说明</Title>
          <Table
            size="small"
            pagination={false}
            style={{ marginBottom: 16 }}
            dataSource={[
              { key: 1, field: "类型", required: "✅ 必填", desc: "美食/景点/活动/交通/休息" },
              { key: 2, field: "名称", required: "✅ 必填", desc: "例如「故宫博物院」" },
              { key: 3, field: "开始时间", required: "选填", desc: "时间选择器，15分钟步进" },
              { key: 4, field: "结束时间", required: "选填", desc: "时间选择器，15分钟步进" },
              { key: 5, field: "地点名称", required: "选填", desc: "例如「北京市东城区景山前街4号」" },
              { key: 6, field: "详细地址", required: "选填", desc: "补充地址信息" },
              { key: 7, field: "预计花费", required: "选填", desc: "数字输入，单位 ¥" },
              { key: 8, field: "状态", required: "选填", desc: "待规划/已确认/已完成，默认待规划" },
              { key: 9, field: "备注", required: "选填", desc: "补充说明" },
            ]}
            columns={[
              { title: "字段", dataIndex: "field", width: 100 },
              { title: "必填", dataIndex: "required", width: 80 },
              { title: "说明", dataIndex: "desc" },
            ]}
          />

          <Row gutter={12}>
            <Col>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() =>
                  setModalData({
                    title: "添加日程安排 - 详细步骤",
                    steps: [
                      {
                        title: "找到目标日期",
                        description: "在「每日日程」Tab中，找到你想添加安排的那一天卡片。",
                      },
                      {
                        title: "点击「添加安排」",
                        description: "点击该天卡片右上角的「添加安排」按钮，弹出编辑模态框。",
                      },
                      {
                        title: "选择类型（必填）",
                        description: "选择美食🍜/景点🏛️/活动🎯/交通🚗/休息😴中的一个。",
                      },
                      {
                        title: "填写名称（必填）",
                        description: "输入安排名称，例如「故宫博物院」或「兰拉面」。",
                      },
                      {
                        title: "填写时间（选填）",
                        description:
                          "选择开始时间和结束时间，时间选择器以15分钟为步进单位。",
                      },
                      {
                        title: "填写地点（选填）",
                        description: "输入地点名称和详细地址，方便旅伴找到位置。",
                      },
                      {
                        title: "填写花费（选填）",
                        description: "输入预计花费金额，系统会在行程总览中自动汇总。",
                      },
                      {
                        title: "设置状态（选填）",
                        description:
                          "默认为「待规划」，可改为「已确认」或「已完成」。",
                      },
                      {
                        title: "填写备注（选填）",
                        description: "补充说明信息，如「需要提前预约」「推荐上午去」等。",
                      },
                      {
                        title: "点击「保存」",
                        description: "保存后日程项出现在对应日期卡片中，左侧显示类型图标。",
                      },
                    ],
                  })
                }
              >
                查看添加安排步骤
              </Button>
            </Col>
            <Col>
              <Button
                icon={<EditOutlined />}
                onClick={() =>
                  setModalData({
                    title: "编辑 & 标记完成 - 详细步骤",
                    steps: [
                      {
                        title: "编辑安排",
                        description:
                          "点击日程项右侧的 ✏️ 图标，弹出编辑模态框，修改任意字段后点击「保存」。",
                      },
                      {
                        title: "标记完成",
                        description:
                          "点击日程项右侧的 ✓ 图标，在「已完成」和「待规划」之间切换。已完成的项目会有删除线和半透明效果。",
                      },
                      {
                        title: "删除安排",
                        description:
                          "点击日程项右侧的 🗑️ 图标，弹出确认框，确认后删除该安排。",
                      },
                    ],
                  })
                }
              >
                查看编辑/完成/删除步骤
              </Button>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: "transport",
      label: (
        <span>
          <CarOutlined style={{ marginRight: 8 }} />
          交通安排管理
        </span>
      ),
      children: (
        <div>
          <Paragraph>
            管理出发交通和返程交通，页面分为「出发交通」和「返程交通」两个区域。
          </Paragraph>

          <Title level={5}>交通方式</Title>
          <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
            {[
              { icon: "✈️", label: "飞机" },
              { icon: "🚄", label: "火车" },
              { icon: "🚌", label: "大巴" },
              { icon: "🚗", label: "自驾" },
              { icon: "🚢", label: "轮船" },
              { icon: "🚀", label: "其他" },
            ].map((item) => (
              <Col key={item.label}>
                <Tag style={{ fontSize: 14, padding: "4px 12px" }}>
                  {item.icon} {item.label}
                </Tag>
              </Col>
            ))}
          </Row>

          <Title level={5}>交通字段说明</Title>
          <Table
            size="small"
            pagination={false}
            style={{ marginBottom: 16 }}
            dataSource={[
              { key: 1, field: "交通方式", required: "✅ 必填", desc: "飞机/火车/大巴/自驾/轮船/其他" },
              { key: 2, field: "出发地", required: "选填", desc: "例如「北京首都机场」" },
              { key: 3, field: "到达地", required: "选填", desc: "例如「大阪关西机场」" },
              { key: 4, field: "出发时间", required: "选填", desc: "日期+时间选择器" },
              { key: 5, field: "到达时间", required: "选填", desc: "日期+时间选择器" },
              { key: 6, field: "花费", required: "选填", desc: "数字输入，单位 ¥" },
              { key: 7, field: "状态", required: "选填", desc: "待规划/已预订/已确认/已完成" },
              { key: 8, field: "预订信息", required: "选填", desc: "航班号/车次号/订单号" },
              { key: 9, field: "备注", required: "选填", desc: "补充说明" },
            ]}
            columns={[
              { title: "字段", dataIndex: "field", width: 100 },
              { title: "必填", dataIndex: "required", width: 80 },
              { title: "说明", dataIndex: "desc" },
            ]}
          />

          <Row gutter={12}>
            <Col>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() =>
                  setModalData({
                    title: "添加交通安排 - 详细步骤",
                    steps: [
                      {
                        title: "选择区域",
                        description: "在「交通安排」Tab中，选择「出发交通」或「返程交通」区域。",
                      },
                      {
                        title: "点击「添加」",
                        description: "在对应区域点击「添加」按钮，弹出编辑模态框。",
                      },
                      {
                        title: "选择交通方式（必填）",
                        description: "选择飞机✈️/火车🚄/大巴🚌/自驾🚗/轮船🚢/其他🚀。",
                      },
                      {
                        title: "填写出发地和到达地",
                        description: "例如出发地「北京首都机场」，到达地「大阪关西机场」。",
                      },
                      {
                        title: "选择出发和到达时间",
                        description: "使用日期+时间选择器，分别设置出发和到达时间。",
                      },
                      {
                        title: "填写花费",
                        description: "输入交通花费金额，系统在行程总览自动汇总。",
                      },
                      {
                        title: "设置状态",
                        description:
                          "待规划→已预订→已确认→已完成，随预订进度逐步更新。",
                      },
                      {
                        title: "填写预订信息",
                        description: "输入航班号/车次号/订单号等预订信息。",
                      },
                      {
                        title: "点击「保存」",
                        description: "保存后交通卡片出现在对应区域，显示方式图标、路线、时间和状态。",
                      },
                    ],
                  })
                }
              >
                查看添加交通步骤
              </Button>
            </Col>
            <Col>
              <Button
                icon={<EditOutlined />}
                onClick={() =>
                  setModalData({
                    title: "编辑 & 删除交通 - 详细步骤",
                    steps: [
                      {
                        title: "编辑交通",
                        description: "点击交通卡片底部的 ✏️ 图标，弹出编辑模态框修改后保存。",
                      },
                      {
                        title: "删除交通",
                        description: "点击交通卡片底部的 🗑️ 图标，确认后删除该交通安排。",
                      },
                    ],
                  })
                }
              >
                查看编辑/删除步骤
              </Button>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: "accommodation",
      label: (
        <span>
          <ShopOutlined style={{ marginRight: 8 }} />
          住宿安排管理
        </span>
      ),
      children: (
        <div>
          <Paragraph>管理旅行期间的住宿信息。</Paragraph>

          <Title level={5}>住宿字段说明</Title>
          <Table
            size="small"
            pagination={false}
            style={{ marginBottom: 16 }}
            dataSource={[
              { key: 1, field: "住宿名称", required: "✅ 必填", desc: "例如「京都四条大酒店」" },
              { key: 2, field: "地址", required: "选填", desc: "详细地址" },
              { key: 3, field: "入住日期", required: "✅ 必填", desc: "日期选择器" },
              { key: 4, field: "退房日期", required: "✅ 必填", desc: "日期选择器" },
              { key: 5, field: "花费", required: "选填", desc: "数字输入，单位 ¥" },
              { key: 6, field: "状态", required: "选填", desc: "待规划/已预订/已确认" },
              { key: 7, field: "预订信息", required: "选填", desc: "订单号/确认码" },
              { key: 8, field: "备注", required: "选填", desc: "补充说明" },
            ]}
            columns={[
              { title: "字段", dataIndex: "field", width: 100 },
              { title: "必填", dataIndex: "required", width: 80 },
              { title: "说明", dataIndex: "desc" },
            ]}
          />

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() =>
              setModalData({
                title: "添加住宿安排 - 详细步骤",
                steps: [
                  {
                    title: "进入住宿 Tab",
                    description: "在计划详情页点击「住宿安排」标签页。",
                  },
                  {
                    title: "点击「添加住宿」",
                    description: "点击页面上方的「添加住宿」按钮，弹出编辑模态框。",
                  },
                  {
                    title: "填写住宿名称（必填）",
                    description: "输入住宿名称，例如「京都四条大酒店」。",
                  },
                  {
                    title: "选择入住和退房日期（必填）",
                    description: "使用日期选择器分别选择入住日期和退房日期。",
                  },
                  {
                    title: "填写地址",
                    description: "输入住宿的详细地址，方便旅伴导航。",
                  },
                  {
                    title: "填写花费",
                    description: "输入住宿费用，系统在行程总览自动汇总。",
                  },
                  {
                    title: "设置状态",
                    description: "待规划→已预订→已确认，随预订进度更新。",
                  },
                  {
                    title: "填写预订信息",
                    description: "输入订单号/确认码等预订信息。",
                  },
                  {
                    title: "点击「保存」",
                    description: "保存后住宿卡片出现在列表中，显示名称、日期、地址和状态。",
                  },
                ],
              })
            }
          >
            查看添加住宿步骤
          </Button>
        </div>
      ),
    },
    {
      key: "overview",
      label: (
        <span>
          <FileTextOutlined style={{ marginRight: 8 }} />
          行程总览
        </span>
      ),
      children: (
        <div>
          <Paragraph>
            以只读形式展示整个旅行计划的完整概览，方便浏览和分享。
          </Paragraph>

          <Title level={5}>总览内容</Title>
          <Card size="small" style={{ marginBottom: 16 }}>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              <li>
                <Text strong>标题区</Text>：计划名称 + 日期范围 + 目的地
              </li>
              <li>
                <Text strong>统计概览</Text>（4 列数据卡片）：
                <ul style={{ marginTop: 4 }}>
                  <li>天数（蓝色）— 旅行总天数</li>
                  <li>安排总数（绿色）— 所有日程项数量</li>
                  <li>住宿数（橙色）— 住宿安排数量</li>
                  <li>预计总花费（粉色）— 自动汇总所有交通+住宿+日程项的花费</li>
                </ul>
              </li>
              <li>
                <Text strong>交通概要</Text>：列出所有交通安排，显示类型、出发地→到达地、时间
              </li>
              <li>
                <Text strong>每日行程</Text>：按天列出所有安排项，显示类型图标、时间、名称、地点、花费
              </li>
              <li>
                <Text strong>底部邀请码</Text>：显示邀请码，提示分享给旅伴
              </li>
            </ul>
          </Card>
        </div>
      ),
    },
    {
      key: "status",
      label: (
        <span>
          <CheckCircleOutlined style={{ marginRight: 8 }} />
          状态体系 & 快速上手流程
        </span>
      ),
      children: (
        <div>
          <Title level={5}>状态流转体系</Title>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Paragraph style={{ marginBottom: 8 }}>
              <Text strong>旅行计划状态</Text>：
              <Tag>规划中 planning</Tag> → <Tag color="processing">进行中 ongoing</Tag> →{" "}
              <Tag color="success">已完成 completed</Tag>
            </Paragraph>
            <Paragraph style={{ marginBottom: 8 }}>
              <Text strong>交通/住宿状态</Text>：
              <Tag>待规划 pending</Tag> → <Tag color="blue">已预订 booked</Tag> →{" "}
              <Tag color="cyan">已确认 confirmed</Tag> → <Tag color="success">已完成 completed</Tag>
            </Paragraph>
            <Paragraph style={{ marginBottom: 0 }}>
              <Text strong>日程项状态</Text>：
              <Tag>待规划 pending</Tag> → <Tag color="cyan">已确认 confirmed</Tag> →{" "}
              <Tag color="success">已完成 done</Tag>
            </Paragraph>
          </Card>

          <Title level={5}>推荐使用流程</Title>
          <Steps
            direction="vertical"
            size="small"
            current={0}
            items={[
              {
                title: "创建计划",
                description: "填写名称、日期范围，系统自动生成日程骨架和邀请码",
              },
              {
                title: "邀请旅伴",
                description: "复制邀请码分享给朋友，他们输入邀请码即可加入",
              },
              {
                title: "规划每日日程",
                description: "在「每日日程」Tab中，为每天添加景点、美食、活动等安排",
              },
              {
                title: "确认交通",
                description: "在「交通安排」Tab中，添加出发和返程交通，标记预订状态",
              },
              {
                title: "预订住宿",
                description: "在「住宿安排」Tab中，添加住宿信息，标记预订状态",
              },
              {
                title: "查看总览",
                description: "在「行程总览」Tab中，查看完整行程计划和总花费",
              },
              {
                title: "逐步更新状态",
                description: "随着规划推进，更新各项状态从待规划→已预订→已确认→已完成",
              },
            ]}
          />

          <Divider />

          <Alert
            type="warning"
            showIcon
            message="当前版本限制"
            description={
              <ul style={{ paddingLeft: 20, margin: 0 }}>
                <li>无实时协作：多人同时编辑需要手动刷新页面才能看到对方改动</li>
                <li>暂不支持导出 PDF：但「行程总览」与分享页均提供「导出长图」按钮，可一键生成 PNG 分享图</li>
              </ul>
            }
          />
        </div>
      ),
    },
  ];
}
