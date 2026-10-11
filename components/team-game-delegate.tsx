import { setTeamGameDelegateAction } from "@/app/teams/actions";

type Member = { userId: string; displayName: string };

/** Captain picks one member who may run games (ready, end, scores) for the team. */
export function TeamGameDelegate({ teamId, captain, delegateUserId, members, language }: {
  teamId: string;
  captain: boolean;
  delegateUserId: string | null;
  members: Member[];
  language: "th" | "en";
}) {
  const th = language === "th";
  const delegate = members.find((member) => member.userId === delegateUserId);
  return <div className="team-delegate">
    <h3>{th ? "ผู้ช่วยหัวหน้า" : "Game delegate"}</h3>
    <p>{th ? "กดพร้อม ขอจบเกม และส่งคะแนนแทนหัวหน้าได้ เหมาะกับวันที่หัวหน้าไม่ได้พกมือถือ" : "Can confirm ready, end games, and submit scores for the captain."}</p>
    {captain ? <form action={setTeamGameDelegateAction}>
      <input type="hidden" name="teamId" value={teamId}/>
      <select name="delegateUserId" defaultValue={delegateUserId ?? ""} aria-label={th ? "เลือกผู้ช่วยหัวหน้า" : "Choose game delegate"}>
        <option value="">{th ? "ไม่มี" : "None"}</option>
        {members.map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}
      </select>
      <button className="team-secondary-button">{th ? "บันทึก" : "Save"}</button>
    </form> : <strong>{delegate ? delegate.displayName : (th ? "ยังไม่ได้กำหนด" : "Not set")}</strong>}
  </div>;
}
