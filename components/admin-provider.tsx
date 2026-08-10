"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { addAdminEvent, addMaintenanceReport, cancelAdminEvent, setCourtOpen, setDailyTargetScore, updateAdminEvent, updateMaintenanceStatus } from "@/lib/admin-rules";
import { LocalStorageAdminRepository, type AdminRepository } from "@/lib/admin-repository";
import type { AdminDataState, AdminEvent, MaintenanceCategory, MaintenanceStatus } from "@/lib/admin-types";
import type { CourtId } from "@/lib/queue-types";

type AdminContextValue = { ready: boolean; state: AdminDataState | null; setCourt(courtId: CourtId, isOpen: boolean): void; setTarget(format: "3x3" | "5x5", score: number): boolean; createEvent(input: Omit<AdminEvent, "id" | "status" | "createdAt">): void; updateEvent(id:string,input:Omit<AdminEvent,"id"|"status"|"createdAt">):void; cancelEvent(id: string): void; addReport(input: { courtId: CourtId; category: MaintenanceCategory; details: string; imageName?: string }): void; setReportStatus(id: string, status: MaintenanceStatus): void; resetAdmin(): void };
const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children, repository }: { children: React.ReactNode; repository?: AdminRepository }) {
  const repo = useMemo(() => repository ?? new LocalStorageAdminRepository(), [repository]);
  const [state, setState] = useState<AdminDataState | null>(null);
  useEffect(() => { const frame = requestAnimationFrame(() => setState(repo.load())); return () => cancelAnimationFrame(frame); }, [repo]);
  function commit(next: AdminDataState) { repo.save(next); setState(next); }
  return <AdminContext.Provider value={{ ready: Boolean(state), state, setCourt:(id,isOpen)=>state&&commit(setCourtOpen(state,id,isOpen)), setTarget:(format,score)=>{if(!state)return false;const next=setDailyTargetScore(state,format,score);if(!next)return false;commit(next);return true}, createEvent:(input)=>state&&commit(addAdminEvent(state,{...input,id:`event-${crypto.randomUUID()}`,status:"ACTIVE",createdAt:new Date().toISOString()})), updateEvent:(id,input)=>state&&commit(updateAdminEvent(state,id,input)), cancelEvent:(id)=>state&&commit(cancelAdminEvent(state,id)), addReport:(input)=>state&&commit(addMaintenanceReport(state,{...input,id:`maintenance-${crypto.randomUUID()}`,status:"NEW",createdAt:new Date().toISOString()})), setReportStatus:(id,status)=>state&&commit(updateMaintenanceStatus(state,id,status)), resetAdmin:()=>setState(repo.reset()) }}>{children}</AdminContext.Provider>;
}
export function useAdminData(){const value=useContext(AdminContext);if(!value)throw new Error("useAdminData must be used inside AdminProvider");return value}
