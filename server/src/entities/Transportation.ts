import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Trip } from "./Trip";

@Entity("transportations")
export class Transportation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  tripId: string;

  @Column({ type: "varchar" })
  type: string; // departure | return | intercity

  @Column({ type: "varchar" })
  transportType: string; // flight | train | bus | car | ship | other

  @Column({ type: "varchar", nullable: true })
  departurePlace: string;

  @Column({ type: "varchar", nullable: true })
  arrivalPlace: string;

  @Column({ type: "timestamp", nullable: true })
  departureTime: string;

  @Column({ type: "timestamp", nullable: true })
  arrivalTime: string;

  @Column({ type: "varchar", default: "pending" })
  status: string;

  @Column({ type: "text", nullable: true })
  bookingInfo: string;

  @Column({ type: "text", nullable: true })
  notes: string;

  @Column({ type: "float", nullable: true })
  cost: number;

  @Column({ type: "float", nullable: true })
  depLat: number;

  @Column({ type: "float", nullable: true })
  depLng: number;

  @Column({ type: "float", nullable: true })
  arrLat: number;

  @Column({ type: "float", nullable: true })
  arrLng: number;

  // ===== 城际匹配草稿字段（交通信息匹配）=====
  @Column({ type: "float", nullable: true })
  distanceM: number;

  @Column({ type: "float", nullable: true })
  durationMin: number;

  @Column({ type: "text", nullable: true })
  polyline: string; // GCJ-02 坐标点 JSON

  @Column({ type: "varchar", nullable: true })
  fromItemId: string; // 关联起点 ScheduleItem

  @Column({ type: "varchar", nullable: true })
  toItemId: string; // 关联终点 ScheduleItem

  @Column({ type: "boolean", default: false })
  matched: boolean; // true=系统生成的建议草稿，待用户确认

  @ManyToOne(() => Trip, (trip) => trip.transportations, { onDelete: "CASCADE" })
  @JoinColumn({ name: "tripId" })
  trip: Trip;
}
