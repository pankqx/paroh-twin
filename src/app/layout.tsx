import type { Metadata } from "next";
import AtmosphereShell from "@/components/Atmosphere/AtmosphereShell";
import Navbar from "@/components/Navbar/Navbar";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Paroh",
  description: "Your personal twin. You decide what it knows.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=Caveat:wght@500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AtmosphereShell />
        <Navbar />
        {children}
      </body>
    </html>
  );
}
