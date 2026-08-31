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

  // select:false 防止默认查询带出密码哈希（详情/分享接口会级联返回 members.user）
  @Column({ type: "varchar", nullable: true, select: false })
  password: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => TripMember, (member) => member.user)
  memberships: TripMember[];
}
