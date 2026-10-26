import { publicApiUrl } from "@/services/api-client";

export function GoogleSignInButton() {
  return (
    <a
      href={publicApiUrl("/auth/google")}
      className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <span aria-hidden="true" className="font-bold text-[#4285f4]">
        G
      </span>
      Continuar com Google
    </a>
  );
}
