import { describe, expect, it } from "vitest";
import { attachmentDisposition } from "./content-disposition";

describe("attachmentDisposition", () => {
  it("passes an ordinary name through unchanged", () => {
    expect(attachmentDisposition("ficha.pdf")).toBe(
      `attachment; filename="ficha.pdf"; filename*=UTF-8''ficha.pdf`
    );
  });

  it("keeps an accented name readable in filename*", () => {
    const header = attachmentDisposition("relatório-lição.pdf");

    // The plain parameter cannot carry the accents...
    expect(header).toContain('filename="relat_rio-li__o.pdf"');
    // ...but nothing is lost: this is the part browsers actually use.
    expect(decodeURIComponent(header.split("filename*=UTF-8''")[1]!)).toBe("relatório-lição.pdf");
  });

  it("neutralises a name that tries to inject another header parameter", () => {
    const header = attachmentDisposition('x.pdf"; filename="evil.html');

    // One quoted filename, and it is not evil.html.
    expect(header).toContain('filename="x.pdf__ filename=_evil.html"');
    expect(header.match(/filename="/g)).toHaveLength(1);
  });

  it("strips a newline, which would otherwise start a header of its own", () => {
    expect(attachmentDisposition("a\r\nX-Evil: 1.pdf")).toContain('filename="a__X-Evil: 1.pdf"');
  });
});
