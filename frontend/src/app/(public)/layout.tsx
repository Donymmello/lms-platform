import { PublicNav } from "@/components/shared/public-nav";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <PublicNav />
      <div className="container py-8">{children}</div>
    </div>
  );
}
