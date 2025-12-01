"use client"

import Image from "next/image"

export function AppHeader() {
  return (
    <header className="mb-12 grid gap-6 lg:grid-cols-[auto,1fr] lg:items-center">
      <div className="flex justify-center lg:justify-start">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/40 bg-primary/5 shadow-lg shadow-primary/10">
          <Image
            src="/rembuganai-logo.svg"
            alt="RembuganAI logo"
            width={56}
            height={56}
            priority
          />
        </div>
      </div>
      <div className="space-y-4 text-center lg:text-left">
        <div className="inline-flex items-center justify-center gap-2 rounded-full bg-primary/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-primary lg:justify-start">
          RembuganAI
        </div>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Saka obrolan dadi tindakan.
        </h1>
        <p className="text-muted-foreground">
          Ringkas rapat produk, tangkap keputusan penting, dan dapatkan draft spesifikasi siap kirim dalam hitungan menit.
        </p>
      </div>
    </header>
  )
}
