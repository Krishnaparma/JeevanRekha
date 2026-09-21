import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#04060d",
};

export const metadata: Metadata = {
  title: "JeevanRekha · Suryanagar 108 Emergency Bed Network",
  description:
    "Graph + priority-queue emergency hospital bed allocator for Suryanagar: choose your locality, see nearby hospitals with live bed availability, and get routed to the nearest hospital that actually has a khaali bed.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-night-950 font-sans text-mist-100 antialiased">
        {children}
      </body>
    </html>
  );
}
