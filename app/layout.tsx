import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vectorly — Retrieval infrastructure",
  description: "A retrieval-aware AI infrastructure workspace."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
