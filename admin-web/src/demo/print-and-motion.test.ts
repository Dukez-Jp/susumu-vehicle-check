import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/* Duas regras do projeto que erodem em silencio:

   1. Nenhuma mudanca de aparencia entra em @media print. O formulario sai no
      layout japones original; regra de cor, sombra ou vidro no bloco de
      impressao muda o papel sem ninguem perceber na tela.

   2. Toda animacao de entrada precisa de contraparte em
      prefers-reduced-motion. As animacoes usam fill "backwards", que segura o
      elemento em opacity 0 antes de comecar. Sem a escapatoria, quem pediu
      menos movimento ao sistema veria o painel em branco. */

const bruto = readFileSync(join(__dirname, "demo.css"), "utf8");
// Comentarios citam "@media print" em prosa; sem remove-los, a busca acha o
// texto sobre a regra em vez da regra.
const css = bruto.replace(/\/\*[\s\S]*?\*\//g, "");

/* O mesmo at-rule aparece varias vezes no arquivo. Juntar todos os blocos e
   o que torna a verificacao honesta: checar so o primeiro daria aprovado com
   a escapatoria faltando em outro lugar. */
function blocoDe(regra: string): string {
  const partes: string[] = [];
  let busca = 0;
  for (;;) {
    const inicio = css.indexOf(regra, busca);
    if (inicio === -1) break;
    let profundidade = 0;
    let i = css.indexOf("{", inicio);
    const abre = i;
    for (; i < css.length; i += 1) {
      if (css[i] === "{") profundidade += 1;
      if (css[i] === "}") {
        profundidade -= 1;
        if (profundidade === 0) break;
      }
    }
    partes.push(css.slice(abre, i + 1));
    busca = i + 1;
  }
  return partes.join("\n");
}

describe("regras de impressao e de movimento", () => {
  it("nao deixa aparencia entrar em @media print", () => {
    const bloco = blocoDe("@media print");
    expect(bloco.length).toBeGreaterThan(0);
    // Propriedades de aparencia que nao pertencem ao formulario impresso.
    const proibidas = [
      /backdrop-filter/,
      /box-shadow\s*:(?!\s*none)/,
      /\bgradient\(/,
      /\banimation\s*:(?!\s*none)/,
      /\btransition\s*:(?!\s*none)/,
      /--glow/,
      /var\(--brand/,
    ];
    for (const proibida of proibidas) {
      expect(
        proibida.test(bloco),
        `@media print contem ${proibida} — aparencia nao entra na impressao`,
      ).toBe(false);
    }
  });

  it("toda animacao de entrada tem escapatoria em prefers-reduced-motion", () => {
    const escape = blocoDe("@media (prefers-reduced-motion: reduce)");
    expect(escape.length).toBeGreaterThan(0);
    // Os seletores que recebem a cascata de entrada.
    const animados = [
      ".workspace .bento > .card",
      ".workspace .bento .launcher",
      ".workspace .bento .welcome-panel",
    ];
    for (const seletor of animados) {
      expect(
        css.includes(`${seletor} {`) || css.includes(`${seletor},`),
        `seletor ausente do CSS: ${seletor}`,
      ).toBe(true);
      expect(
        escape.includes(seletor),
        `${seletor} anima mas nao tem escapatoria em prefers-reduced-motion`,
      ).toBe(true);
    }
    expect(escape).toMatch(/animation:\s*none/);
  });

  it("a animacao de entrada usa backwards, entao a escapatoria e obrigatoria", () => {
    // Se este casamento deixar de existir, o teste acima perde o sentido e
    // precisa ser revisto junto.
    expect(css).toMatch(/animation:\s*bento-entra[^;]*backwards/);
    expect(blocoDe("@keyframes bento-entra")).toMatch(/opacity:\s*0/);
  });
});
