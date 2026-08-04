import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { Trip } from "./Trip";

export type ExpenseCategory = "food" | "transport" | "lodging" | "ticket" | "shopping" | "other";

@Entity("expenses")
export class Expense {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  tripId: string;

  @Column({ type: "varchar", length: 100 })
  title: string;

  // 分类：food/transport/lodging/ticket/shopping/other
  @Column({ type: "varchar", default: "other" })
  category: string;

  @Column({ type: "float" })
  amount: number;

  // 谁掏的钱
  @Column({ type: "varchar" })
  payerId: string;

  // 参与分摊的 userId 列表，JSON 存储
  @Column({ type: "text", default: "[]" })
  participantIds: string;

  // 发生日期
  @Column({ type: "date", nullable: true })
  expenseDate: string;

  @Column({ type: "text", nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Trip, (trip) => trip.expenses, { onDelete: "CASCADE" })
  @JoinColumn({ name: "tripId" })
  trip: Trip;
}
