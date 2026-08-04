import client from "./client";
import type {
  Trip,
  Transportation,
  Accommodation,
  DailySchedule,
  ScheduleItem,
  Expense,
  ExpenseStats,
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

  getMembers: (tripId: string) =>
    client.get(`/trips/${tripId}/members`).then((r) => r.data),

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
  list: (tripId: string) =>
    client.get<DailySchedule[]>(`/trips/${tripId}/schedules`).then(
      (r) => r.data
    ),

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
