"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { submitMaintenanceReportAction } from "@/app/maintenance/actions";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function MaintenanceReportForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function selectFile(file?: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setFileName("");
    setError("");

    if (!file) return;
    if (!allowedTypes.has(file.type)) {
      setError("รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("รูปภาพต้องมีขนาดไม่เกิน 5 MB");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setFileName(file.name);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function removeFile() {
    selectFile();
    if (inputRef.current) inputRef.current.value = "";
  }

  return <form className="maintenance-form" action={submitMaintenanceReportAction}>
    <label><span>สนาม</span><select name="court" required defaultValue=""><option value="" disabled>เลือกสนาม</option><option value="3x3-a">3x3 A</option><option value="3x3-b">3x3 B</option><option value="5x5">5x5</option></select></label>
    <label><span>ประเภทปัญหา</span><select name="category" required defaultValue=""><option value="" disabled>เลือกประเภท</option><option value="SURFACE">พื้นสนาม</option><option value="HOOP">แป้นหรือห่วง</option><option value="LIGHTING">ระบบไฟ</option><option value="OTHER">อื่น ๆ</option></select></label>
    <label><span>รายละเอียด</span><textarea name="details" required minLength={5} maxLength={1000} rows={5}/></label>
    <div>
      <label className="maintenance-upload"><input ref={inputRef} name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectFile(event.target.files?.[0])}/><b>{fileName ? "✓" : "＋"}</b>{fileName ? "แนบรูปแล้ว" : "แนบรูป (ไม่บังคับ)"}</label>
      {error ? <p className="maintenance-upload-error" role="alert">{error}</p> : null}
      {previewUrl ? <div className="maintenance-image-preview"><Image src={previewUrl} alt="ตัวอย่างรูปภาพแจ้งซ่อม" width={640} height={360} unoptimized/><div><span title={fileName}>{fileName}</span><button type="button" onClick={removeFile}>เอารูปออก</button></div></div> : null}
    </div>
    <button className="queue-primary-button">ส่งรายการแจ้งซ่อม</button>
  </form>;
}
