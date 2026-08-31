import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { DailySchedule } from "./DailySchedule";

@Entity("schedule_items")
export class ScheduleItem {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  scheduleId: string;

  @Column({ type: "varchar" })
  tripId: string;

  @Column({ type: "int" })
  sortOrder: number;

  @Column({ type: "varchar" })
  type: string;

  @Column({ type: "varchar", length: 100 })
  title: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "varchar", nullable: true })
  locationName: string;

  @Column({ type: "varchar", nullable: true })
  address: string;

  @Column({ type: "float", nullable: true })
  lat: number;

  @Column({ type: "float", nullable: true })
  lng: number;

  @Column({ type: "time", nullable: true })
  startTime: string;

  @Column({ type: "time", nullable: true })
  endTime: string;

  @Column({ type: "float", nullable: true })
  cost: number;

  @Column({ type: "text", nullable: true })
  notes: string;

  @Column({ type: "varchar", nullable: true })
  imageUrl: string;

  @Column({ type: "varchar", nullable: true })
  transportToNext: string;

  // ===== 结构化接驳字段（交通信息匹配）=====
  @Column({ type: "varchar", nullable: true })
  legMode: string; // walking | driving | transit | intercity | none

  @Column({ type: "float", nullable: true })
  legDistanceM: number; // 接驳距离（米）

  @Column({ type: "float", nullable: true })
  legDurationMin: number; // 接驳时长（分钟）

  @Column({ type: "text", nullable: true })
  legPolyline: string; // GCJ-02 坐标点 JSON：[{lat,lng},...]

  @Column({ type: "varchar", nullable: true })
  legSummary: string; // 展示文案，如「驾车约 12 分钟 · 3.2 km」

  @Column({ type: "boolean", default: false })
  legAutoMatched: boolean; // 是否系统自动匹配（人工修改后置 false，重跑不覆盖）

  @Column({ type: "varchar", default: "pending" })
  status: string;

  @Column({ type: "int", default: 1 })
  version: number;

  @ManyToOne(() => DailySchedule, (schedule) => schedule.items, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "scheduleId" })
  schedule: DailySchedule;
}
