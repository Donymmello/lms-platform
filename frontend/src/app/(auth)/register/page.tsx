import type { Metadata } from "next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Criar conta | LMS",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
