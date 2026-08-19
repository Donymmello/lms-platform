import { z } from "zod";

// Mirrors backend/src/modules/auth/schemas/auth.schema.ts so invalid input
// is caught client-side before a request is even sent.
export const registerSchema = z.object({
  name: z.string().trim().min(2, "O nome deve ter pelo menos 2 caracteres").max(120),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z
    .string()
    .min(8, "A palavra-passe deve ter pelo menos 8 caracteres")
    .max(72)
    .regex(/[a-z]/, "A palavra-passe deve conter uma letra minúscula")
    .regex(/[A-Z]/, "A palavra-passe deve conter uma letra maiúscula")
    .regex(/[0-9]/, "A palavra-passe deve conter um número"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(1, "A palavra-passe é obrigatória"),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;
export type LoginFormValues = z.infer<typeof loginSchema>;
