import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MeQ | สนามบาส มหาวิทยาลัยนเรศวร",
  description: "แดชบอร์ดคิวสนามบาสและแจ้งซ่อม มหาวิทยาลัยนเรศวร",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
