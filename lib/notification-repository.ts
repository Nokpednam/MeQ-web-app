import type { MockNotification, NotificationDataState } from "./notification-types";
export interface NotificationRepository { load(): NotificationDataState; save(state: NotificationDataState): void; add(item: MockNotification): NotificationDataState; reset(): NotificationDataState }
export const NOTIFICATION_STORAGE_KEY = "meq-notifications-mvp-v1";
const initial = (): NotificationDataState => ({ version: 1, items: [] });
export class LocalStorageNotificationRepository implements NotificationRepository {
  load(): NotificationDataState { try { const raw=window.localStorage.getItem(NOTIFICATION_STORAGE_KEY); if(!raw)return this.reset(); const parsed:unknown=JSON.parse(raw); if(!parsed||typeof parsed!=="object"||(parsed as NotificationDataState).version!==1||!Array.isArray((parsed as NotificationDataState).items)||(parsed as NotificationDataState).items.some((item)=>!item||typeof item.id!=="string"||typeof item.kind!=="string"||typeof item.courtId!=="string"||typeof item.createdAt!=="string"))return this.reset(); return parsed as NotificationDataState; } catch{return this.reset();} }
  save(state: NotificationDataState): void { window.localStorage.setItem(NOTIFICATION_STORAGE_KEY,JSON.stringify(state)); }
  add(item: MockNotification): NotificationDataState { const state=this.load(); const next={...state,items:[item,...state.items].slice(0,30)}; this.save(next); return next; }
  reset(): NotificationDataState { const state=initial(); this.save(state); return state; }
}
