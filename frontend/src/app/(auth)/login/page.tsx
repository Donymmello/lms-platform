import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar | Protagonista Academy",
};

export default function LoginPage() {
  return <LoginForm />;
}
