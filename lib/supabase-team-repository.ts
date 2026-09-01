import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import type { Team, User } from "./team-types";

type ProfileRow = { id: string; display_name: string; avatar_url: string | null; role?: "USER" | "ADMIN" };
type MembershipRow = { team_id: string; user_id: string; role: "CAPTAIN" | "MEMBER"; joined_at: string };
type TeamRow = { id: string; name: string; format: "THREE_X_THREE" | "FIVE_X_FIVE"; captain_user_id: string; created_at: string; dissolved_at: string | null };
type InvitationRow = { id: string; team_id: string; invited_user_id: string; invited_by_user_id: string; created_at: string };

export type AuthTeamProfile = { id: string; displayName: string; initials: string; avatarUrl: string | null; role: "USER" | "ADMIN" };
export type TeamInvitation = {
  id: string;
  teamId: string;
  teamName: string;
  invitedUserId: string;
  invitedUserName: string;
  invitedByName: string;
  createdAt: string;
};
export type TeamPageData = {
  currentUser: AuthTeamProfile;
  currentTeam: Team | null;
  users: User[];
  incomingInvitations: TeamInvitation[];
  outgoingInvitations: TeamInvitation[];
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "NU";
}

export async function getTeamPageData(supabase: SupabaseClient, userId: string): Promise<TeamPageData> {
  const [profileResult, profilesResult, membershipsResult, teamsResult, invitationsResult] = await Promise.all([
    supabase.from("profiles").select("id,display_name,avatar_url,role").eq("id", userId).single(),
    supabase.from("profiles").select("id,display_name,avatar_url").order("display_name"),
    supabase.from("team_memberships").select("team_id,user_id,role,joined_at").is("left_at", null),
    supabase.from("teams").select("id,name,format,captain_user_id,created_at,dissolved_at").is("dissolved_at", null),
    supabase.from("team_invitations").select("id,team_id,invited_user_id,invited_by_user_id,created_at").eq("status", "PENDING").order("created_at", { ascending: false }),
  ]);

  const profile = profileResult.data as ProfileRow | null;
  if (!profile) throw new Error("PROFILE_NOT_FOUND");
  if (invitationsResult.error) throw new Error("TEAM_INVITATIONS_UNAVAILABLE");
  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const memberships = (membershipsResult.data ?? []) as MembershipRow[];
  const teams = (teamsResult.data ?? []) as TeamRow[];
  const invitations = (invitationsResult.data ?? []) as InvitationRow[];
  const ownMembership = memberships.find((item) => item.user_id === userId);
  let currentTeam: Team | null = null;

  if (ownMembership) {
    const team = teams.find((item) => item.id === ownMembership.team_id) ?? null;
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
  const profileById = new Map(profiles.map((item) => [item.id, item]));
  const teamById = new Map(teams.map((item) => [item.id, item]));
  const mappedInvitations = invitations.flatMap((invitation) => {
    const team = teamById.get(invitation.team_id);
    const invitedUser = profileById.get(invitation.invited_user_id);
    const invitedBy = profileById.get(invitation.invited_by_user_id);
    if (!team || !invitedUser || !invitedBy) return [];
    return [{
      id: invitation.id,
      teamId: invitation.team_id,
      teamName: team.name,
      invitedUserId: invitation.invited_user_id,
      invitedUserName: invitedUser.display_name,
      invitedByName: invitedBy.display_name,
      createdAt: invitation.created_at,
    }];
  });
  return {
    currentUser: { id: profile.id, displayName: profile.display_name, initials: initials(profile.display_name), avatarUrl: profile.avatar_url, role: profile.role === "ADMIN" ? "ADMIN" : "USER" },
    currentTeam,
    users: profiles.map((item) => ({ id: item.id, displayName: item.display_name, initials: initials(item.display_name), currentTeamId: membershipByUser.get(item.id) ?? null })),
    incomingInvitations: mappedInvitations.filter((item) => item.invitedUserId === userId),
    outgoingInvitations: mappedInvitations.filter((item) => item.teamId === currentTeam?.id),
  };
}

/** Deduplicate the team feed when a layout and its page render in one request. */
export const getCachedTeamPageData = cache(getTeamPageData);

export async function getTeamById(supabase: SupabaseClient, teamId: string, userId: string) {
  const data = await getCachedTeamPageData(supabase, userId);
  return data.currentTeam?.id === teamId ? data : { ...data, currentTeam: null };
}
