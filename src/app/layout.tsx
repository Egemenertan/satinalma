import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { NotificationManager } from "@/components/NotificationManager";
import { Providers } from "./providers";
import { STORAGE_URLS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Satın Alma Talebi Yönetim Sistemi",
  description: "Şantiye satın alma talepleri için modern yönetim sistemi",
  manifest: '/manifest.json',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      'max-video-preview': -1,
      'max-image-preview': 'none',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/blackdu.webp',
    shortcut: '/blackdu.webp',
    apple: '/blackdu.webp',
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
        <Providers>
          <ToastProvider>
            <NotificationManager />
            <div className="min-h-screen ">
              {children}
            </div>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
