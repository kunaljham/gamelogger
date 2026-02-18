import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const VIDEO_URL =
  "https://f666cezksly1onuo.public.blob.vercel-storage.com/demo.mp4";
const OG_IMAGE_URL =
  "https://f666cezksly1onuo.public.blob.vercel-storage.com/og-image.png";

export const metadata: Metadata = {
  title: "GameLogger - Track Your Squash Matches",
  description:
    "Track your friendly squash matches with ease. Log scores, add notes, and keep your match history organized.",
  openGraph: {
    title: "GameLogger - Track Your Squash Matches",
    description:
      "Track your friendly squash matches without affecting your USR.",
    type: "website",
    url: "https://gamelogger.app",
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1920,
        height: 1080,
        type: "image/png",
      },
    ],
    videos: [
      {
        url: VIDEO_URL,
        width: 1920,
        height: 1080,
        type: "video/mp4",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GameLogger - Track Your Squash Matches",
    description:
      "Track your friendly squash matches without affecting your USR.",
    images: [OG_IMAGE_URL],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
