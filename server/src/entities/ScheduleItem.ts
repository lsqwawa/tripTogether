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
