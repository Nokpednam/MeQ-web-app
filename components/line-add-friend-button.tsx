"use client";
import Image from "next/image";
import { useRef } from "react";
import { LINE_OA_ADD_FRIEND_URL, LINE_OA_BASIC_ID } from "@/lib/line-official-account";

/**
 * Phones open the LINE app straight to the "Add friend" screen. Computers
 * cannot add friends from a browser, so they get a QR code to scan instead.
 */
export function LineAddFriendButton({ label = "เพิ่มเพื่อน MeQ", className = "line-add-friend-button" }: { label?: string; className?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    const isPhone = window.matchMedia("(pointer: coarse)").matches && window.innerWidth < 900;
    if (isPhone) return; // Let the link open the LINE app.
    event.preventDefault();
    dialogRef.current?.showModal();
  }

  return <>
    <a className={className} href={LINE_OA_ADD_FRIEND_URL} onClick={handleClick}>
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.5s5.8-3.4 7.9-5.9C21.3 14.3 22 12.7 22 11c0-4.4-4.5-8-10-8Z"/></svg>
      {label}
    </a>
    <dialog ref={dialogRef} className="line-qr-dialog" aria-labelledby="line-qr-title" onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current?.close(); }}>
      <div>
        <h2 id="line-qr-title">สแกนเพื่อเพิ่มเพื่อน MeQ</h2>
        <p>เปิดกล้องหรือแอป LINE บนมือถือ แล้วสแกน QR นี้</p>
        <Image src="/line-oa-qr.png" alt={`QR code เพิ่มเพื่อน LINE ${LINE_OA_BASIC_ID}`} width={220} height={220}/>
        <p className="line-qr-id">หรือค้นหา ID <strong>{LINE_OA_BASIC_ID}</strong> ในแอป LINE</p>
        <div className="line-qr-actions">
          <a href={LINE_OA_ADD_FRIEND_URL} target="_blank" rel="noopener noreferrer">เปิดหน้าเพิ่มเพื่อนในเบราว์เซอร์</a>
          <button type="button" onClick={() => dialogRef.current?.close()}>ปิด</button>
        </div>
      </div>
    </dialog>
  </>;
}
