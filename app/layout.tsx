import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AmbientMusicProvider from "../components/gallery/AmbientMusic";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Faeron",
  // description: "Faeron is a personal website i made out of boredom",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AmbientMusicProvider>{children}</AmbientMusicProvider>
      </body>
    </html>
  );
}
