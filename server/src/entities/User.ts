import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from "typeorm";
import { TripMember } from "./TripMember";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 50 })
  nickname: string;

  @Column({ type: "varchar", nullable: true })
  avatar: string;

  @Column({ type: "varchar", nullable: true })
  password: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => TripMember, (member) => member.user)
  memberships: TripMember[];
}
