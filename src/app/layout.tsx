import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { NotificationManager } from "@/components/NotificationManager";

export const metadata: Metadata = {
  title: "Satın Alma Talebi Yönetim Sistemi",
  description: "Şantiye satın alma talepleri için modern yönetim sistemi",
  manifest: '/manifest.json',
  icons: {
    icon: 'https://yxzmxfwpgsqabtamnfql.supabase.co/storage/v1/object/public/satinalma/dove.png',
    shortcut: 'https://yxzmxfwpgsqabtamnfql.supabase.co/storage/v1/object/public/satinalma/dove.png',
    apple: 'https://yxzmxfwpgsqabtamnfql.supabase.co/storage/v1/object/public/satinalma/dove.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Satın Alma',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="font-helvetica-neue">
        <ToastProvider>
          <NotificationManager />
          <div className="min-h-screen ">
            {children}
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
