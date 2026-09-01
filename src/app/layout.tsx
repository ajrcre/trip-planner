import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { getAuthSession } from "@/lib/auth";
import { SessionProvider } from "@/components/providers/SessionProvider";
import GlobalAiButton from "@/components/ai/GlobalAiButton";
import { ServiceWorkerRegistration } from "@/components/offline/ServiceWorkerRegistration";
import { OfflineWarmup } from "@/components/offline/OfflineWarmup";
import { OfflineBanner } from "@/components/offline/OfflineBanner";
import { RevalidatingIndicator } from "@/components/offline/RevalidatingIndicator";
import { PathMemory } from "@/components/routing/PathMemory";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Handing the session to the provider removes the client-side
  // GET /api/auth/session that every screen otherwise waits on before it can
  // decide whether the user is signed in — the slowest step of a cold open on a
  // weak connection.
  // getAuthSession rather than getServerSession so the BYPASS_AUTH dev path
  // signs the client in too — otherwise every `useSession()` in the app reports
  // signed out locally.
  const session = await getAuthSession();

  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <head>
        {/* The overview and schedule maps both hit Google as soon as they mount;
            opening the connections during HTML parse saves a DNS+TLS round trip
            on a slow network. */}
        <link rel="preconnect" href="https://maps.googleapis.com" />
        <link rel="preconnect" href="https://maps.gstatic.com" crossOrigin="" />
      </head>
      <body className="min-h-full flex flex-col">
          <SessionProvider session={session}>
            <ServiceWorkerRegistration />
            <OfflineWarmup />
            <OfflineBanner />
            <RevalidatingIndicator />
            <PathMemory />
            {children}
            <GlobalAiButton />
          </SessionProvider>
        </body>
    </html>
  );
}
