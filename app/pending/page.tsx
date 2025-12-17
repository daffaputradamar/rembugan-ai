import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, AlertCircle } from "lucide-react"

export default async function PendingPage() {
  const session = await auth()

  // If not authenticated, redirect to login
  if (!session?.user) {
    redirect("/login")
  }

  // If already approved, redirect to home
  if (session.user.status === "APPROVED") {
    redirect("/")
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
            <Clock className="w-6 h-6 text-yellow-500" />
          </div>
          <CardTitle>Akun Menunggu Persetujuan</CardTitle>
          <CardDescription>
            Akun Anda sedang dalam proses verifikasi
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-medium text-yellow-700 dark:text-yellow-400">
                  Status: {session.user.status === "PENDING" ? "Menunggu" : "Ditolak"}
                </p>
                <p className="text-muted-foreground">
                  {session.user.status === "PENDING" 
                    ? "Administrator sedang meninjau permintaan akses Anda. Anda akan menerima notifikasi melalui email setelah akun Anda disetujui."
                    : "Permintaan akses Anda telah ditolak. Silakan hubungi administrator untuk informasi lebih lanjut."
                  }
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong>Email:</strong> {session.user.email}
            </p>
            <p>
              <strong>Nama:</strong> {session.user.name || "-"}
            </p>
          </div>

          <div className="pt-4">
            <form action={async () => {
              "use server"
              const { signOut } = await import("@/auth")
              await signOut({ redirectTo: "/login" })
            }}>
              <Button type="submit" variant="outline" className="w-full">
                Keluar
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
