import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { NotificationManager } from "@/components/NotificationManager";
import { WarehouseGmoPurchaseRequestAlerts } from "@/components/WarehouseGmoPurchaseRequestAlerts";
import { Providers } from "./providers";
import { AuthSessionSync } from "@/components/AuthSessionSync";

export const metadata: Metadata = {
  title: "Satın Alma Talebi Yönetim Sistemi",
  description: "Şantiye satın alma talepleri için modern yönetim sistemi",
  manifest: '/site.webmanifest',
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
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
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
  themeColor: '#000000',
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
          <AuthSessionSync />
          <ToastProvider>
            <NotificationManager />
            <WarehouseGmoPurchaseRequestAlerts />
            <div className="min-h-screen ">
              {children}
            </div>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
