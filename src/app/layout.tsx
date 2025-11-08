import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppContextProvider } from "../context/AppContext";
import Footer from "@/components/Footer";
import NavbarWrapper from "@/components/navbar/NavbarWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CF Ladder – Smart Codeforces Ladder & Problem Tracker",
  description:
    "Boost your Codeforces rating with CF Ladder – the smarter way to practice problems, track progress, and level up your competitive programming journey.",
  keywords: [
    "CF Ladder",
    "Codeforces Ladder",
    "Competitive Programming Ladder",
    "CF Tracker",
    "Codeforces Problem Tracker",
    "Competitive Programming Practice",
    "CF Ranking",
    "CF Stats",
  ],
  authors: [{ name: "Jubayer Ahmed" }],
  viewport: "width=device-width, initial-scale=1",
  openGraph: {
    title: "CF Ladder – Smart Codeforces Ladder & Problem Tracker",
    description:
      "Practice Codeforces problems smartly, track progress, and improve your rating with CF Ladder – your go-to CP companion.",
    url: "https://cf-ladder-pro.vercel.app/",
    siteName: "CF Ladder",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "https://res.cloudinary.com/ddysafn4k/image/upload/v1761489634/coding_8061324_p0o1nb.png",
        width: 1200,
        height: 630,
        alt: "CF Ladder – Codeforces Ladder & Problem Tracker",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CF Ladder – Smart Codeforces Ladder & Problem Tracker",
    description:
      "Track your Codeforces progress, practice problems efficiently, and climb the competitive programming ladder.",
    images: [
      "https://res.cloudinary.com/ddysafn4k/image/upload/v1761489634/coding_8061324_p0o1nb.png",
    ],
  },
  metadataBase: new URL("https://cf-ladder-pro.vercel.app"),
  alternates: {
    canonical: "https://cf-ladder-pro.vercel.app",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* Google AdSense Script */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4944066273658213"
          crossOrigin="anonymous"
        />

        {/* Google AdSense Account */}
        <meta
          name="google-adsense-account"
          content="ca-pub-4944066273658213"
        />

        {/* Google Site Verification */}
        <meta
          name="google-site-verification"
          content="DkY7lbwjx25NBdwjWjmupzINAtZ7-cIT9RMnVV3Wy-c"
        />

        {/* Font Awesome */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css"
          integrity="sha512-papb/0kqH9Yp+...=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>

      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppContextProvider>
          <NavbarWrapper />
          {children}
          <Footer />
        </AppContextProvider>
      </body>
    </html>
  );
}
