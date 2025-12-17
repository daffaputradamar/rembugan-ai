import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import {
  Inter
} from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/components/auth-provider"
import { ThemeProvider } from "@/components/theme-provider"

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
    <html lang="en" suppressHydrationWarning>
      <body className={`min-h-screen bg-background text-foreground font-sans ${_inter.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <div className="modern-bg">
              <div className="neon-glow neon-glow-orange" style={{ width: "500px", height: "500px", top: "-100px", right: "-100px" }} />
              <div className="neon-glow neon-glow-blue" style={{ width: "400px", height: "400px", bottom: "-50px", left: "-50px" }} />
            </div>
            {children}
          </AuthProvider>
        <Toaster richColors />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
