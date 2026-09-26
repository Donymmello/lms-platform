import { Suspense } from "react";
import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Nova palavra-passe | Estúdio",
};

export default function ResetPasswordPage() {
  // The form reads the token from the query string, so it needs a Suspense
  // boundary for `useSearchParams` during prerendering.
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
