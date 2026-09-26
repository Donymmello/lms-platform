import { env } from "../config/env";

/**
 * Deliberately plain HTML with inline styles and a table-free single column:
 * mail clients strip <style> blocks, ignore most modern CSS, and several
 * render dark backgrounds badly. The amber accent is the only nod to the
 * app's own palette.
 */
function layout(heading: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  const button = cta
    ? `<p style="margin:28px 0 0">
         <a href="${cta.url}" style="display:inline-block;background:#e0a13a;color:#1a1713;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:999px">${cta.label}</a>
       </p>`
    : "";

  return `<!doctype html>
<html lang="pt">
  <body style="margin:0;padding:24px;background:#f5f3f0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1713">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
      <p style="margin:0 0 24px;font-size:20px;font-weight:700;letter-spacing:-0.01em">Estúdio</p>
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${heading}</h1>
      ${bodyHtml}
      ${button}
    </div>
    <p style="max-width:520px;margin:16px auto 0;font-size:12px;color:#8a8279;text-align:center">
      Recebeste este email porque tens conta no Estúdio.
    </p>
  </body>
</html>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4a443d">${text}</p>`;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function welcomeEmail(name: string): RenderedEmail {
  const url = `${env.PUBLIC_APP_URL}/courses`;
  return {
    subject: "Bem-vindo ao Estúdio",
    html: layout(
      `Olá, ${name}`,
      paragraph("A tua conta está criada. Explora o catálogo e inscreve-te no primeiro curso.") +
        paragraph("Os cursos em que te inscreveres ficam disponíveis em «Os meus cursos», com o teu progresso guardado."),
      { label: "Explorar catálogo", url }
    ),
    text: `Olá, ${name}\n\nA tua conta no Estúdio está criada. Explora o catálogo em ${url}`,
  };
}

export function passwordResetEmail(name: string, rawToken: string): RenderedEmail {
  const url = `${env.PUBLIC_APP_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;
  return {
    subject: "Redefinir a tua palavra-passe",
    html: layout(
      "Redefinir palavra-passe",
      paragraph(`Olá, ${name}. Recebemos um pedido para redefinir a palavra-passe da tua conta.`) +
        paragraph("O link abaixo só funciona uma vez e expira dentro de uma hora.") +
        paragraph(
          "Se não foste tu a pedir, ignora este email — a tua palavra-passe atual continua a funcionar."
        ),
      { label: "Definir nova palavra-passe", url }
    ),
    text: `Olá, ${name}

Para redefinir a palavra-passe: ${url}

O link expira dentro de uma hora e só pode ser usado uma vez. Se não foste tu a pedir, ignora este email.`,
  };
}

export function enrollmentEmail(name: string, courseTitle: string, courseSlug: string): RenderedEmail {
  const url = `${env.PUBLIC_APP_URL}/student/courses/${courseSlug}`;
  return {
    subject: `Estás inscrito em ${courseTitle}`,
    html: layout(
      `Inscrição confirmada`,
      paragraph(`Olá, ${name}. A tua inscrição em <strong>${courseTitle}</strong> está confirmada.`) +
        paragraph("Podes começar quando quiseres — o teu progresso fica guardado entre sessões."),
      { label: "Começar o curso", url }
    ),
    text: `Olá, ${name}\n\nEstás inscrito em ${courseTitle}. Começa em ${url}`,
  };
}

export function paymentReceiptEmail(
  name: string,
  courseTitle: string,
  courseSlug: string,
  amountCents: number,
  currency: string
): RenderedEmail {
  const url = `${env.PUBLIC_APP_URL}/student/courses/${courseSlug}`;
  const amount = (amountCents / 100).toLocaleString("pt-MZ", { style: "currency", currency });

  return {
    subject: `Pagamento confirmado — ${courseTitle}`,
    html: layout(
      "Pagamento confirmado",
      paragraph(`Olá, ${name}. Recebemos o teu pagamento de <strong>${amount}</strong>.`) +
        paragraph(`O curso <strong>${courseTitle}</strong> já está disponível na tua área.`),
      { label: "Ir para o curso", url }
    ),
    text: `Olá, ${name}\n\nPagamento de ${amount} confirmado. ${courseTitle} já está disponível em ${url}`,
  };
}
