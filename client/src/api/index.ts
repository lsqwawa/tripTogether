import client from "./client";
import type {
  Trip,
  TripMember,
  Transportation,
  Accommodation,
  DailySchedule,
  ScheduleItem,
  Expense,
  ExpenseStats,
  ChecklistItem,
  WeatherDay,
  User,
} from "../types";

// ==================== User ====================

export const userApi = {
  register: (nickname: string, password: string) =>
    client
      .post<{ user: User; token: string }>("/users/register", { nickname, password })
      .then((r) => r.data),

  login: (nickname: string, password?: string) =>
    client
      .post<{ user: User; token: string }>("/users/login", { nickname, password })
      .then((r) => r.data),

  me: () => client.get<User>("/users/me").then((r) => r.data),

  updateMe: (data: { nickname?: string; avatar?: string }) =>
    client.patch<User>("/users/me", data).then((r) => r.data),

  myTrips: () => client.get<Trip[]>("/users/me/trips").then((r) => r.data),
};

// ==================== Trip ====================

export const tripApi = {
  list: () => client.get<Trip[]>("/trips").then((r) => r.data),

  get: (tripId: string) =>
    client.get<Trip>(`/trips/${tripId}`).then((r) => r.data),

  create: (data: {
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    destination?: string;
  }) => client.post<Trip>("/trips", data).then((r) => r.data),

  update: (tripId: string, data: Partial<Trip>) =>
    client.patch<Trip>(`/trips/${tripId}`, data).then((r) => r.data),

  delete: (tripId: string) =>
    client.delete(`/trips/${tripId}`).then((r) => r.data),

  join: (inviteCode: string) =>
    client.post<{ trip: Trip; alreadyMember: boolean }>("/trips/join", {
      inviteCode,
    }).then((r) => r.data),

  updateMemberRole: (tripId: string, memberId: string, role: string) =>
    client
      .patch<TripMember>(`/trips/${tripId}/members/${memberId}`, { role })
      .then((r) => r.data),

  removeMember: (tripId: string, memberId: string) =>
    client.delete(`/trips/${tripId}/members/${memberId}`).then((r) => r.data),

  getByShareCode: (inviteCode: string) =>
    client.get<Trip>(`/trips/share/${inviteCode}`).then((r) => r.data),
};

// ==================== Transportation ====================

export const transportApi = {
  list: (tripId: string) =>
    client.get<Transportation[]>(`/trips/${tripId}/transportations`).then(
      (r) => r.data
    ),

  create: (tripId: string, data: Partial<Transportation>) =>
    client
      .post<Transportation>(`/trips/${tripId}/transportations`, data)
      .then((r) => r.data),

  update: (tripId: string, id: string, data: Partial<Transportation>) =>
    client
      .patch<Transportation>(`/trips/${tripId}/transportations/${id}`, data)
      .then((r) => r.data),

  delete: (tripId: string, id: string) =>
    client.delete(`/trips/${tripId}/transportations/${id}`).then((r) => r.data),
};

// ==================== 交通班次查询（代理） =================

export const transportLookupApi = {
  get: (type: "flight" | "train", code: string) =>
    client
      .get<{
        success: boolean;
        source: "aviationstack" | "mock" | "12306";
        data: any;
      }>("/transport-lookup", { params: { type, code } })
      .then((r) => r.data),
};

// ==================== 图片上传 =================

export const uploadApi = {
  image: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return client.post<{ url: string }>("/upload", fd).then((r) => r.data);
  },
};

// ==================== Accommodation ====================

export const accommodationApi = {
  list: (tripId: string) =>
    client.get<Accommodation[]>(`/trips/${tripId}/accommodations`).then(
      (r) => r.data
    ),

  create: (tripId: string, data: Partial<Accommodation>) =>
    client
      .post<Accommodation>(`/trips/${tripId}/accommodations`, data)
      .then((r) => r.data),

  update: (tripId: string, id: string, data: Partial<Accommodation>) =>
    client
      .patch<Accommodation>(`/trips/${tripId}/accommodations/${id}`, data)
      .then((r) => r.data),

  delete: (tripId: string, id: string) =>
    client.delete(`/trips/${tripId}/accommodations/${id}`).then((r) => r.data),
};

// ==================== Schedule ====================

export const scheduleApi = {
  update: (tripId: string, scheduleId: string, data: Partial<DailySchedule>) =>
    client
      .patch<DailySchedule>(`/trips/${tripId}/schedules/${scheduleId}`, data)
      .then((r) => r.data),

  addItem: (
    tripId: string,
    scheduleId: string,
    data: Partial<ScheduleItem>
  ) =>
    client
      .post<ScheduleItem>(
        `/trips/${tripId}/schedules/${scheduleId}/items`,
        data
      )
      .then((r) => r.data),

  updateItem: (
    tripId: string,
    scheduleId: string,
    itemId: string,
    data: Partial<ScheduleItem>
  ) =>
    client
      .patch<ScheduleItem>(
        `/trips/${tripId}/schedules/${scheduleId}/items/${itemId}`,
        data
      )
      .then((r) => r.data),

  deleteItem: (tripId: string, scheduleId: string, itemId: string) =>
    client
      .delete(
        `/trips/${tripId}/schedules/${scheduleId}/items/${itemId}`
      )
      .then((r) => r.data),

  reorderItems: (tripId: string, scheduleId: string, itemIds: string[]) =>
    client
      .post(`/trips/${tripId}/schedules/${scheduleId}/items/reorder`, {
        itemIds,
      })
      .then((r) => r.data),
};

// ==================== Expense ====================

export const expenseApi = {
  list: (tripId: string) =>
    client.get<Expense[]>(`/trips/${tripId}/expenses`).then((r) => r.data),

  create: (
    tripId: string,
    data: {
      title: string;
      category: string;
      amount: number;
      payerId: string;
      participantIds: string[];
      expenseDate?: string;
      notes?: string;
    }
  ) =>
    client
      .post<Expense>(`/trips/${tripId}/expenses`, data)
      .then((r) => r.data),

  update: (tripId: string, id: string, data: any) =>
    client
      .patch<Expense>(`/trips/${tripId}/expenses/${id}`, data)
      .then((r) => r.data),

  delete: (tripId: string, id: string) =>
    client.delete(`/trips/${tripId}/expenses/${id}`).then((r) => r.data),

  stats: (tripId: string) =>
    client
      .get<ExpenseStats>(`/trips/${tripId}/expenses/stats`)
      .then((r) => r.data),
};

// ==================== Checklist（行李清单） ====================

export const checklistApi = {
  list: (tripId: string) =>
    client.get<ChecklistItem[]>(`/trips/${tripId}/checklist`).then((r) => r.data),

  create: (tripId: string, data: { name: string; category?: string }) =>
    client
      .post<ChecklistItem>(`/trips/${tripId}/checklist`, data)
      .then((r) => r.data),

  addTemplate: (tripId: string) =>
    client
      .post<{ added: number }>(`/trips/${tripId}/checklist/template`)
      .then((r) => r.data),

  update: (
    tripId: string,
    id: string,
    data: { checked?: boolean; name?: string; category?: string }
  ) =>
    client
      .patch<ChecklistItem>(`/trips/${tripId}/checklist/${id}`, data)
      .then((r) => r.data),

  delete: (tripId: string, id: string) =>
    client.delete(`/trips/${tripId}/checklist/${id}`).then((r) => r.data),
};

// ==================== Weather（天气代理） ====================

export const weatherApi = {
  daily: (params: { lat: number; lng: number; start: string; end: string }) =>
    client
      .get<{ days: WeatherDay[] }>("/weather", { params })
      .then((r) => r.data.days),
};

// ==================== Transport Match（交通匹配） ====================

export const transportMatchApi = {
  match: (tripId: string) =>
    client
      .post<{
        legsApplied: number;
        legsTotal: number;
        skippedNoCoord: number;
        intercityDrafts: Transportation[];
        via: string | null;
        message?: string;
      }>(`/trips/${tripId}/match-transport`)
      .then((r) => r.data),

  legs: (tripId: string) =>
    client
      .get<{ legs: ScheduleItem[]; drafts: Transportation[] }>(
        `/trips/${tripId}/transport-legs`
      )
      .then((r) => r.data),

  updateLeg: (
    tripId: string,
    itemId: string,
    data: {
      legMode?: string;
      legSummary?: string;
      legDistanceM?: number;
      legDurationMin?: number;
    }
  ) =>
    client
      .patch<ScheduleItem>(`/trips/${tripId}/schedule-items/${itemId}/transport`, data)
      .then((r) => r.data),

  // 删除某段接驳（匹配错了可清除重来）
  clearLeg: (tripId: string, itemId: string) =>
    client
      .delete<ScheduleItem>(`/trips/${tripId}/schedule-items/${itemId}/transport`)
      .then((r) => r.data),

  confirm: (tripId: string, id: string, data?: Partial<Transportation>) =>
    client
      .patch<Transportation>(`/trips/${tripId}/transportations/${id}/confirm`, data || {})
      .then((r) => r.data),
};
