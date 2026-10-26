import type { Metadata } from "next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Criar conta | Protagonista Academy",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
