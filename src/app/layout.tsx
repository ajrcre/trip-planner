import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { SessionProvider } from "@/components/providers/SessionProvider";
import GlobalAiButton from "@/components/ai/GlobalAiButton";
import { ServiceWorkerRegistration } from "@/components/offline/ServiceWorkerRegistration";
import { OfflineWarmup } from "@/components/offline/OfflineWarmup";
import { OfflineBanner } from "@/components/offline/OfflineBanner";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

export const metadata: Metadata = {
  title: "מתכנן טיולים",
  description: "מתכנן טיולים משפחתי",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  // iOS ignores the manifest's display mode and reads this instead, so without
  // it "add to home screen" still opens in a Safari chrome.
  appleWebApp: {
    capable: true,
    title: "טיולים",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
          <SessionProvider>
            <ServiceWorkerRegistration />
            <OfflineWarmup />
            <OfflineBanner />
            {children}
            <GlobalAiButton />
          </SessionProvider>
        </body>
    </html>
  );
}
