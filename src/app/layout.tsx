import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/noto-sans-thai";
import "@fontsource/bai-jamjuree/500.css";
import "@fontsource/bai-jamjuree/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "PalmTrack — UX/UI Prototype",
  description: "ต้นแบบระบบบริหารงานวิจัยและสวนปาล์มด้วยข้อมูลสังเคราะห์",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html data-scroll-behavior="smooth" lang="th">
      <body>{children}</body>
    </html>
  );
}
