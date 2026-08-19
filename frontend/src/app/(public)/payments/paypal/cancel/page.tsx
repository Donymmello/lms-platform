import Link from "next/link";
import { XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function PaypalCancelPage() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <XCircle className="h-10 w-10 text-muted-foreground" />
      <div>
        <p className="text-lg font-semibold">Pagamento cancelado</p>
        <p className="text-muted-foreground">Não te preocupes, nada foi cobrado.</p>
      </div>
      <Button asChild variant="outline">
        <Link href="/courses">Voltar ao catálogo</Link>
      </Button>
    </div>
  );
}
