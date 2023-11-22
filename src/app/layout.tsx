import "~/styles/globals.css";

import { Analytics } from "@vercel/analytics/react";

import { Inter } from "next/font/google";
import { headers } from "next/headers";

import { cn } from "~/lib/utils";
import { TRPCReactProvider } from "~/trpc/react";
import Navbar from "./components/Navbar";
import { Toaster } from "./components/ui/toaster";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata = {
  title: "Maika",
  description: "El portal de Maika",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div
          className={cn(
            `font-sans ${inter.variable}`,
            "mx-4 mb-12 bg-background text-foreground lg:mx-8",
          )}
        >
          <TRPCReactProvider headers={headers()}>
            <Navbar />
            <main className="my-2 min-h-full">
              {children}
              <Analytics />
              <Toaster />
            </main>
          </TRPCReactProvider>
        </div>
      </body>
    </html>
  );
}
