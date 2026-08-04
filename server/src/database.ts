import "reflect-metadata";
import "dotenv/config";
import { DataSource } from "typeorm";
import { User } from "./entities/User";
import { Trip } from "./entities/Trip";
import { TripMember } from "./entities/TripMember";
import { Transportation } from "./entities/Transportation";
import { Accommodation } from "./entities/Accommodation";
import { DailySchedule } from "./entities/DailySchedule";
import { ScheduleItem } from "./entities/ScheduleItem";
import { Expense } from "./entities/Expense";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "trip_together",
  synchronize: (process.env.DB_SYNCHRONIZE ?? "true") === "true",
  logging: false,
  entities: [
    User,
    Trip,
    TripMember,
    Transportation,
    Accommodation,
    DailySchedule,
    ScheduleItem,
    Expense,
  ],
});
