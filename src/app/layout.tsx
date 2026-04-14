import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { SessionProvider } from "@/components/providers/SessionProvider";
import GlobalAiButton from "@/components/ai/GlobalAiButton";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "מתכנן טיולים",
  description: "מתכנן טיולים משפחתי",
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
            {children}
            <GlobalAiButton />
          </SessionProvider>
        </body>
    </html>
  );
}
