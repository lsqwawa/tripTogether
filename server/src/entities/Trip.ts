import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from "typeorm";
import { TripMember } from "./TripMember";
import { Transportation } from "./Transportation";
import { Accommodation } from "./Accommodation";
import { DailySchedule } from "./DailySchedule";
import { Expense } from "./Expense";

@Entity("trips")
export class Trip {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 100 })
  title: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "date" })
  startDate: string;

  @Column({ type: "date" })
  endDate: string;

  @Column({ type: "varchar", nullable: true })
  coverImage: string;

  @Column({ type: "varchar", default: "planning" })
  status: string;

  @Column({ type: "varchar", unique: true, length: 12 })
  inviteCode: string;

  @Column({ type: "varchar", nullable: true })
  destination: string;

  @Column({ type: "float", nullable: true })
  budgetTotal: number;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => TripMember, (member) => member.trip)
  members: TripMember[];

  @OneToMany(() => Transportation, (t) => t.trip)
  transportations: Transportation[];

  @OneToMany(() => Accommodation, (a) => a.trip)
  accommodations: Accommodation[];

  @OneToMany(() => DailySchedule, (d) => d.trip)
  schedules: DailySchedule[];

  @OneToMany(() => Expense, (e) => e.trip)
  expenses: Expense[];
}
