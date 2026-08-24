export default function Loading() {
  return (
    <main className="route-loading" aria-live="polite" aria-busy="true">
      <span className="route-loading-spinner" aria-hidden="true" />
      <strong>กำลังโหลดข้อมูล…</strong>
      <p>กรุณารอสักครู่</p>
    </main>
  );
}
