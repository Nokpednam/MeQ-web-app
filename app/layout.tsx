import type { Metadata } from "next";
import { AppProviders } from "@/components/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "MeQ | สนามบาส มหาวิทยาลัยนเรศวร",
  description: "แดชบอร์ดคิวสนามบาสและแจ้งซ่อม มหาวิทยาลัยนเรศวร",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body><AppProviders>{children}</AppProviders></body>
    </html>
  );
}
