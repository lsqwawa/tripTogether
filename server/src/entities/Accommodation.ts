import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Trip } from "./Trip";

@Entity("accommodations")
export class Accommodation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  tripId: string;

  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "varchar", nullable: true })
  address: string;

  @Column({ type: "date" })
  checkInDate: string;

  @Column({ type: "date" })
  checkOutDate: string;

  @Column({ type: "varchar", default: "pending" })
  status: string;

  @Column({ type: "text", nullable: true })
  bookingInfo: string;

  @Column({ type: "text", nullable: true })
  notes: string;

  @Column({ type: "float", nullable: true })
  cost: number;

  @Column({ type: "float", nullable: true })
  lat: number;

  @Column({ type: "float", nullable: true })
  lng: number;

  @ManyToOne(() => Trip, (trip) => trip.accommodations, { onDelete: "CASCADE" })
  @JoinColumn({ name: "tripId" })
  trip: Trip;
}
