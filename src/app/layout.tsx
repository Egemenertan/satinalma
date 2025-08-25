import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Satın Alma Talebi Yönetim Sistemi",
  description: "Şantiye satın alma talepleri için modern yönetim sistemi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="font-helvetica-neue">
        <div className="min-h-screen ">
          {children}
        </div>
      </body>
    </html>
  );
}
