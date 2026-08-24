import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import type { Team, User } from "./team-types";

type ProfileRow = { id: string; display_name: string; avatar_url: string | null; role?: "USER" | "ADMIN" };
type MembershipRow = { team_id: string; user_id: string; role: "CAPTAIN" | "MEMBER"; joined_at: string };
type TeamRow = { id: string; name: string; format: "THREE_X_THREE" | "FIVE_X_FIVE"; captain_user_id: string; created_at: string; dissolved_at: string | null };

export type AuthTeamProfile = { id: string; displayName: string; initials: string; avatarUrl: string | null; role: "USER" | "ADMIN" };
export type TeamPageData = { currentUser: AuthTeamProfile; currentTeam: Team | null; users: User[] };

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "NU";
}

export async function getTeamPageData(supabase: SupabaseClient, userId: string): Promise<TeamPageData> {
  const [{ data: profileData }, { data: profilesData }, { data: membershipsData }] = await Promise.all([
    supabase.from("profiles").select("id,display_name,avatar_url,role").eq("id", userId).single(),
    supabase.from("profiles").select("id,display_name,avatar_url").order("display_name"),
    supabase.from("team_memberships").select("team_id,user_id,role,joined_at").is("left_at", null),
  ]);

  const profile = profileData as ProfileRow | null;
  if (!profile) throw new Error("PROFILE_NOT_FOUND");
  const profiles = (profilesData ?? []) as ProfileRow[];
  const memberships = (membershipsData ?? []) as MembershipRow[];
  const ownMembership = memberships.find((item) => item.user_id === userId);
  let currentTeam: Team | null = null;

  if (ownMembership) {
    const { data: teamData } = await supabase.from("teams").select("id,name,format,captain_user_id,created_at,dissolved_at").eq("id", ownMembership.team_id).is("dissolved_at", null).maybeSingle();
    const team = teamData as TeamRow | null;
    if (team) {
      const teamMemberships = memberships.filter((item) => item.team_id === team.id);
      const { data: queueData } = await supabase.from("queue_entries").select("id").eq("team_id", team.id).in("status", ["WAITING", "CALLED", "CHECKING_IN", "READY_TO_PLAY", "PLAYING", "AWAITING_SCORE", "RESTING", "RETURNING_CHAMPION", "DECIDING_REQUEUE", "DECIDING_CONTINUE"]).limit(1);
      currentTeam = {
        id: team.id,
        name: team.name,
        type: team.format,
        captainUserId: team.captain_user_id,
        createdAt: team.created_at,
        rosterLocked: Boolean(queueData?.length),
        members: teamMemberships.map((item) => ({ userId: item.user_id, role: item.role, joinedAt: item.joined_at })),
      };
    }
  }

  const membershipByUser = new Map(memberships.map((item) => [item.user_id, item.team_id]));
  return {
    currentUser: { id: profile.id, displayName: profile.display_name, initials: initials(profile.display_name), avatarUrl: profile.avatar_url, role: profile.role === "ADMIN" ? "ADMIN" : "USER" },
    currentTeam,
    users: profiles.map((item) => ({ id: item.id, displayName: item.display_name, initials: initials(item.display_name), currentTeamId: membershipByUser.get(item.id) ?? null })),
  };
}

/** Deduplicate the team feed when a layout and its page render in one request. */
export const getCachedTeamPageData = cache(getTeamPageData);

export async function getTeamById(supabase: SupabaseClient, teamId: string, userId: string) {
  const data = await getCachedTeamPageData(supabase, userId);
  return data.currentTeam?.id === teamId ? data : { ...data, currentTeam: null };
}
