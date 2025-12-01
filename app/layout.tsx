import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import {
  Inter
} from "next/font/google"
import { Toaster } from "@/components/ui/sonner"

const _inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

export const metadata: Metadata = {
  title: "RembuganAI",
  description: "Saka obrolan dadi tindakan—RembuganAI bantu tim produk merangkum rapat dan menyiapkan draft spesifikasi secara instan.",
  generator: "RembuganAI",
  keywords: ["AI", "meeting", "summary", "product specification", "RembuganAI"],
  authors: [{ name: "RembuganAI" }],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`min-h-screen bg-background text-foreground font-sans ${_inter.variable}`}>
        {/* Futuristic Background */}
        <div className="futuristic-bg">
          <div className="glow-orb glow-orb-1" />
          <div className="glow-orb glow-orb-2" />
          <div className="glow-orb glow-orb-3" />
          <div className="scan-line" />
          <div className="noise-overlay" />
        </div>
        {children}
        <Toaster richColors />
        <Analytics />
      </body>
    </html>
  )
}
