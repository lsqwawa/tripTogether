// ==================== 基础类型 ====================

export interface User {
  id: string;
  nickname: string;
  avatar?: string;
  createdAt: string;
}

export type TripStatus = "planning" | "ongoing" | "completed";
export type MemberRole = "owner" | "editor" | "viewer";
export type TransportType =
  | "flight"
  | "train"
  | "bus"
  | "car"
  | "ship"
  | "other";
export type PlanStatus = "pending" | "booked" | "confirmed" | "completed" | "done";
export type ScheduleItemType =
  | "food"
  | "attraction"
  | "activity"
  | "transport"
  | "rest";

export type ExpenseCategory =
  | "food"
  | "transport"
  | "lodging"
  | "ticket"
  | "shopping"
  | "other";

export interface ChecklistItem {
  id: string;
  tripId: string;
  name: string;
  category: ChecklistCategory | string;
  checked: boolean;
  sortOrder: number;
  createdAt: string;
}

export type ChecklistCategory =
  | "documents"
  | "clothing"
  | "electronics"
  | "toiletries"
  | "medicine"
  | "other";

export interface WeatherDay {
  date: string;
  text: string;
  icon: string;
  tmax: number;
  tmin: number;
  precipProb?: number | null;
}

export interface Expense {
  id: string;
  tripId: string;
  title: string;
  category: ExpenseCategory | string;
  amount: number;
  payerId: string;
  participantIds: string; // JSON string
  expenseDate?: string;
  notes?: string;
  createdAt: string;
}

export interface ExpenseStatsItem {
  userId: string;
  nickname: string;
  paid: number;
  owed: number;
  net: number;
}

export interface ExpenseStats {
  total: number;
  perCapita: number;
  memberCount: number;
  participantCount?: number;
  items: ExpenseStatsItem[];
}

export interface Trip {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  coverImage?: string;
  status: TripStatus;
  inviteCode: string;
  destination?: string;
  budgetTotal?: number;
  createdAt: string;
  members?: TripMember[];
  transportations?: Transportation[];
  accommodations?: Accommodation[];
  schedules?: DailySchedule[];
  expenses?: Expense[];
}

export interface TripMember {
  id: string;
  tripId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
  user?: User;
}

export interface Transportation {
  id: string;
  tripId: string;
  type: "departure" | "return" | "intercity";
  transportType: TransportType;
  departurePlace?: string;
  arrivalPlace?: string;
  departureTime?: string;
  arrivalTime?: string;
  status: PlanStatus;
  bookingInfo?: string;
  notes?: string;
  cost?: number;
  depLat?: number;
  depLng?: number;
  arrLat?: number;
  arrLng?: number;
}

export interface Accommodation {
  id: string;
  tripId: string;
  name: string;
  address?: string;
  checkInDate: string;
  checkOutDate: string;
  status: PlanStatus;
  bookingInfo?: string;
  notes?: string;
  cost?: number;
  lat?: number;
  lng?: number;
}

export interface DailySchedule {
  id: string;
  tripId: string;
  dayIndex: number;
  date: string;
  title?: string;
  items?: ScheduleItem[];
}

export interface ScheduleItem {
  id: string;
  scheduleId: string;
  tripId: string;
  sortOrder: number;
  type: ScheduleItemType;
  title: string;
  description?: string;
  locationName?: string;
  address?: string;
  lat?: number;
  lng?: number;
  startTime?: string;
  endTime?: string;
  cost?: number;
  notes?: string;
  imageUrl?: string;
  transportToNext?: string;
  status: PlanStatus;
  version?: number;
}

// ==================== UI 映射常量 ====================

// 视为「已完成」的状态集合（含历史 done 与 completed 双取值，收敛枚举前须一并保留）
export const DONE_STATUSES: string[] = ["confirmed", "completed", "done"];

export const STATUS_LABELS: Record<string, string> = {
  pending: "待规划",
  booked: "已预订",
  confirmed: "已确认",
  completed: "已完成",
  done: "已完成",
};

export const STATUS_COLORS: Record<string, string> = {
  pending: "default",
  booked: "processing",
  confirmed: "success",
  completed: "green",
  done: "green",
};

export const TRANSPORT_LABELS: Record<string, string> = {
  flight: "飞机",
  train: "火车",
  bus: "大巴",
  car: "自驾",
  ship: "轮船",
  other: "其他",
};

export const TRANSPORT_ICONS: Record<string, string> = {
  flight: "✈️",
  train: "🚄",
  bus: "🚌",
  car: "🚗",
  ship: "🚢",
  other: "🚀",
};

export const ITEM_TYPE_LABELS: Record<string, string> = {
  food: "美食",
  attraction: "景点",
  activity: "活动",
  transport: "交通",
  rest: "休息",
};

export const ITEM_TYPE_ICONS: Record<string, string> = {
  food: "🍜",
  attraction: "🏛️",
  activity: "🎯",
  transport: "🚗",
  rest: "😴",
};

export const TRIP_STATUS_LABELS: Record<string, string> = {
  planning: "规划中",
  ongoing: "进行中",
  completed: "已完成",
};

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  food: "餐饮",
  transport: "交通",
  lodging: "住宿",
  ticket: "门票",
  shopping: "购物",
  other: "其他",
};

export const EXPENSE_CATEGORY_ICONS: Record<string, string> = {
  food: "🍜",
  transport: "🚗",
  lodging: "🏨",
  ticket: "🎫",
  shopping: "🛍️",
  other: "💼",
};

export const EXPENSE_CATEGORY_COLORS: Record<string, string> = {
  food: "orange",
  transport: "blue",
  lodging: "purple",
  ticket: "cyan",
  shopping: "magenta",
  other: "default",
};

export const CHECKLIST_CATEGORY_LABELS: Record<string, string> = {
  documents: "证件财务",
  clothing: "衣物",
  electronics: "电子设备",
  toiletries: "洗漱护理",
  medicine: "药品",
  other: "其他",
};

export const CHECKLIST_CATEGORY_ICONS: Record<string, string> = {
  documents: "🪪",
  clothing: "👕",
  electronics: "🔌",
  toiletries: "🧴",
  medicine: "💊",
  other: "🎒",
};
