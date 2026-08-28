import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Trip } from "./Trip";
import { User } from "./User";

@Entity("trip_members")
export class TripMember {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  tripId: string;

  @Column({ type: "uuid" })
  userId: string;

  @Column({ type: "varchar", default: "editor" })
  role: string;

  @CreateDateColumn()
  joinedAt: Date;

  @ManyToOne(() => Trip, (trip) => trip.members, { onDelete: "CASCADE" })
  @JoinColumn({ name: "tripId" })
  trip: Trip;

  @ManyToOne(() => User, (user) => user.memberships, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;
}
