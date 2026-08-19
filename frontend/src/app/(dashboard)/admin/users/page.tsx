import type { Metadata } from "next";
import { UsersTable } from "./users-table";

export const metadata: Metadata = {
  title: "Utilizadores | LMS Platform",
};

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Utilizadores</h1>
        <p className="mt-1 text-muted-foreground">Gerir contas, funções e acesso à plataforma.</p>
      </div>
      <UsersTable />
    </div>
  );
}
