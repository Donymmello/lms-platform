"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { authService } from "@/services/auth.service";
import { homePathForRole } from "@/lib/routes";
import { useAuthStore } from "@/store/auth.store";

export default function GoogleCallbackPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authService
      .me()
      .then((user) => {
        if (cancelled) return;
        setUser(user);
        router.replace(homePathForRole(user.role));
        router.refresh();
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [router, setUser]);

  if (failed) {
    return (
      <div className="space-y-4 text-center">
        <p role="alert" className="text-sm font-medium text-destructive">
          Não foi possível concluir o início de sessão com Google.
        </p>
        <Button onClick={() => router.replace("/login")}>Voltar ao login</Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      A concluir o início de sessão...
    </div>
  );
}
