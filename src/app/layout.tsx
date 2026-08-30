import type { Metadata } from "next"
import { Inter, Cormorant_Garamond } from "next/font/google"
import "./globals.css"
import { Header } from "@/components/layout/Header"
import { AuthProvider } from "@/components/providers/AuthProvider"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
})

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
})

export const metadata: Metadata = {
  title: "Word Battle - 英语单词PK",
  description: "与朋友一起PK英语单词，提升词汇量",
  icons: {
    icon: [
      { url: "/favicon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.png", sizes: "1024x1024", type: "image/png" },
    ],
    apple: "/favicon-192.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className={`${inter.variable} ${cormorant.variable}`}>
      <body className="min-h-screen bg-canvas text-body">
        <AuthProvider>
          <Header />
          <main className="flex-1">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  )
}
