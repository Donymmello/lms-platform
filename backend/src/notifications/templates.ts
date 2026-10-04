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
      <p style="margin:0 0 24px;font-size:20px;font-weight:700;letter-spacing:-0.01em">LMS</p>
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${heading}</h1>
      ${bodyHtml}
      ${button}
    </div>
    <p style="max-width:520px;margin:16px auto 0;font-size:12px;color:#8a8279;text-align:center">
      Recebeste este email porque tens conta no LMS.
    </p>
  </body>
</html>`;
}

/**
 * Everything that reaches these templates from a user — their name, a course
 * title they chose, the message they typed asking to teach — lands inside an
 * HTML document. Unescaped, a `<` in any of it is markup: at best the mail
 * renders wrong, at worst someone puts a link of their own in a message an
 * admin reads and trusts. Mail clients strip scripts; they do not strip
 * anchors.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
    subject: "Bem-vindo ao LMS",
    html: layout(
      `Olá, ${escapeHtml(name)}`,
      paragraph("A tua conta está criada. Explora o catálogo e inscreve-te no primeiro curso.") +
        paragraph("Os cursos em que te inscreveres ficam disponíveis em «Os meus cursos», com o teu progresso guardado."),
      { label: "Explorar catálogo", url }
    ),
    text: `Olá, ${name}\n\nA tua conta no LMS está criada. Explora o catálogo em ${url}`,
  };
}

export function passwordResetEmail(name: string, rawToken: string): RenderedEmail {
  const url = `${env.PUBLIC_APP_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;
  return {
    subject: "Redefinir a tua palavra-passe",
    html: layout(
      "Redefinir palavra-passe",
      paragraph(
        `Olá, ${escapeHtml(name)}. Recebemos um pedido para redefinir a palavra-passe da tua conta.`
      ) +
        paragraph("O link abaixo só funciona uma vez e expira dentro de uma hora.") +
        paragraph(
          "Se não foste tu a pedir, ignora este email. A tua palavra-passe actual continua a funcionar."
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
      paragraph(
        `Olá, ${escapeHtml(name)}. A tua inscrição em <strong>${escapeHtml(courseTitle)}</strong> está confirmada.`
      ) +
        paragraph("Podes começar quando quiseres. O teu progresso fica guardado entre sessões."),
      { label: "Começar o curso", url }
    ),
    text: `Olá, ${name}\n\nEstás inscrito em ${courseTitle}. Começa em ${url}`,
  };
}

/**
 * One receipt for the whole charge, however many courses it covered. A cart
 * paid in one go should not arrive as three separate emails.
 */
export function paymentReceiptEmail(
  name: string,
  courses: { title: string; slug: string }[],
  amountCents: number,
  currency: string
): RenderedEmail {
  const amount = (amountCents / 100).toLocaleString("pt-MZ", { style: "currency", currency });
  const isSingle = courses.length === 1;
  const titles = courses.map((course) => course.title);

  // One course goes straight to it. Several go to the list, because there is
  // no single right destination.
  const url = isSingle
    ? `${env.PUBLIC_APP_URL}/student/courses/${courses[0]!.slug}`
    : `${env.PUBLIC_APP_URL}/student/courses`;

  const body = isSingle
    ? paragraph(`O curso <strong>${escapeHtml(titles[0]!)}</strong> já está disponível na tua área.`)
    : paragraph("Já tens disponíveis na tua área:") +
      `<ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.6">${titles
        .map((title) => `<li>${escapeHtml(title)}</li>`)
        .join("")}</ul>`;

  return {
    subject: isSingle
      ? `Pagamento confirmado — ${titles[0]}`
      : `Pagamento confirmado — ${courses.length} cursos`,
    html: layout(
      "Pagamento confirmado",
      paragraph(`Olá, ${escapeHtml(name)}. Recebemos o teu pagamento de <strong>${amount}</strong>.`) + body,
      { label: isSingle ? "Ir para o curso" : "Ir para os meus cursos", url }
    ),
    text: `Olá, ${name}\n\nPagamento de ${amount} confirmado.\n${titles.join("\n")}\n\n${url}`,
  };
}

/**
 * Sent to the admins when someone asks to teach. Unlike every other template
 * here, the recipient is not the person the mail is about — so it names them,
 * and it links straight to the screen where the decision is made instead of
 * asking the reader to go and find the account.
 *
 * The message is written by an untrusted stranger and read by an admin who
 * trusts this mailbox, which is exactly the pair that makes escaping matter.
 */
export function instructorRequestEmail(
  applicant: { name: string; email: string },
  message: string
): RenderedEmail {
  const url = `${env.PUBLIC_APP_URL}/admin/users?search=${encodeURIComponent(applicant.email)}`;

  return {
    subject: `Pedido para ensinar — ${applicant.name}`,
    html: layout(
      "Alguém quer ensinar",
      paragraph(
        `<strong>${escapeHtml(applicant.name)}</strong> (${escapeHtml(applicant.email)}) pediu acesso de instrutor.`
      ) +
        `<blockquote style="margin:0 0 12px;padding:12px 16px;border-left:3px solid #e0a13a;background:#faf8f5;font-size:15px;line-height:1.6;color:#4a443d;white-space:pre-wrap">${escapeHtml(
          message
        )}</blockquote>` +
        paragraph("Promove a conta em «Contas», se fizer sentido. A mudança fica no log de auditoria."),
      { label: "Abrir a conta", url }
    ),
    text: `${applicant.name} (${applicant.email}) pediu acesso de instrutor.\n\n${message}\n\n${url}`,
  };
}
