import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Kan jag tälta här? – Friluftslivshjälp",
  description:
    "Karta och allemansrätts-principer som hjälper dig bedöma om du kan tälta. Visar byggnader, brukad mark, naturreservat, eldningsförbud och väder – men ger inget facit.",
  applicationName: "Friluftslivshjälp",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Friluftshjälp",
  },
};

export const viewport: Viewport = {
  themeColor: "#15803d",
  width: "device-width",
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
    <html lang="sv" className="h-full antialiased">
      <body className="h-full font-sans">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
