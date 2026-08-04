import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { Trip } from "./Trip";
import { ScheduleItem } from "./ScheduleItem";

@Entity("daily_schedules")
export class DailySchedule {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  tripId: string;

  @Column({ type: "int" })
  dayIndex: number;

  @Column({ type: "date" })
  date: string;

  @Column({ type: "varchar", nullable: true })
  title: string;

  @ManyToOne(() => Trip, (trip) => trip.schedules, { onDelete: "CASCADE" })
  @JoinColumn({ name: "tripId" })
  trip: Trip;

  @OneToMany(() => ScheduleItem, (item) => item.schedule, { cascade: true })
  items: ScheduleItem[];
}
