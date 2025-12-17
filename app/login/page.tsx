"use client"

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LogIn } from "lucide-react"

export default function LoginPage() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-md items-center justify-center p-4">
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Masuk ke RembuganAI</CardTitle>
          <CardDescription>
            Gunakan akun Keycloak MPM untuk masuk dan mengakses fitur penuh.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => signIn("keycloak", { callbackUrl: "/" })}
            className="w-full gap-2"
            size="lg"
          >
            <LogIn className="h-4 w-4" />
            Masuk dengan Keycloak
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Dengan masuk, Anda dapat menyimpan template dan mengaksesnya dari mana saja.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
