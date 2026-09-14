import { expect, test } from "@playwright/test";

/* O que estes testes cobrem e o jsdom nao alcanca: aparencia renderizada,
   layout de impressao e alvo de toque medido em pixels reais. Sao as lacunas
   que a execucao do KaizenLoop deixou explicitamente como nao verificadas. */

test.beforeEach(async ({ page }) => {
  await page.goto("/demo.html");
  // A demonstracao abre em japones por padrao; a bandeira troca tudo de uma
  // vez. Os seletores abaixo leem o japones, que e o que o mecanico ve.
  await expect(page.locator("#root")).not.toBeEmpty();
});

test("o trilho oferece uma Oficina so", async ({ page }) => {
  const trilho = page.getByRole("navigation");
  await expect(trilho).toBeVisible();
  // 工場 = oficina. Nem "工場 2" nem "工場 3" podem existir.
  await expect(page.getByRole("button", { name: /工場 2|Oficina 2/ })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: /工場 3|Oficina 3/ })).toHaveCount(
    0,
  );
});

test("a impressao esconde a interface e mantem o formulario", async ({
  page,
}) => {
  // Esta e a verificacao que o jsdom nao faz: o Chrome resolve @media print
  // de verdade e diz o que sobra no papel.
  const trilhoNaTela = await page.getByRole("navigation").isVisible();
  expect(trilhoNaTela, "o trilho precisa aparecer na tela").toBe(true);

  await page.emulateMedia({ media: "print" });
  const trilhoNoPapel = await page.getByRole("navigation").isVisible();
  expect(
    trilhoNoPapel,
    "o trilho nao pode sair impresso: @media print o esconde",
  ).toBe(false);

  await page.emulateMedia({ media: "screen" });
  await expect(page.getByRole("navigation")).toBeVisible();
});

test("o painel termina visivel depois da cascata", async ({ page }) => {
  /* A cascata de entrada usa fill "backwards", que segura o bloco invisivel
     antes de comecar. O que importa e o estado final.

     Nao da para esperar document.getAnimations() terminar: a revelacao por
     rolagem usa animation-timeline: view(), que nunca entra em "finished"
     porque a linha do tempo dela e a propria rolagem. A assercao abaixo
     repete sozinha ate a cascata acabar. */
  const blocos = page.locator(".bento > .card");
  const total = await blocos.count();
  expect(total, "o painel bento precisa ter blocos").toBeGreaterThan(0);
  await expect(blocos.first()).toHaveCSS("opacity", "1");

  /* Os blocos abaixo da dobra usam animation-timeline: view() com fill
     "both", entao ficam em opacity 0 de proposito ate entrarem na janela.
     O que precisa ser verdade e que rolar ate eles os revela — senao o
     mecanico rola e continua vendo espaco vazio. */
  for (let i = 0; i < total; i += 1) {
    const bloco = blocos.nth(i);
    await bloco.scrollIntoViewIfNeeded();
    await expect(
      bloco,
      `bloco ${i + 1} de ${total} nao apareceu nem depois de rolar ate ele`,
    ).toHaveCSS("opacity", "1");
  }
});

test("com movimento reduzido o painel aparece inteiro, sem animacao", async ({
  browser,
}) => {
  /* Este e o cenario que so o navegador de verdade verifica. A cascata usa
     fill "backwards": sem a escapatoria em prefers-reduced-motion, o bloco
     ficaria parado em opacity 0 e o mecanico veria o painel em branco. */
  const contexto = await browser.newContext({ reducedMotion: "reduce" });
  const page = await contexto.newPage();
  await page.goto("/demo.html");
  await expect(page.locator("#root")).not.toBeEmpty();

  const blocos = page.locator(".bento > .card");
  const total = await blocos.count();
  expect(total).toBeGreaterThan(0);
  for (let i = 0; i < total; i += 1) {
    const opacidade = await blocos
      .nth(i)
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(
      Number(opacidade),
      `com movimento reduzido, o bloco ${i + 1} ficou invisivel`,
    ).toBeGreaterThan(0.9);
  }
  // E nenhuma animacao deve estar rodando.
  const animando = await page.evaluate(() => document.getAnimations().length);
  expect(animando, "pediram menos movimento e algo continua animando").toBe(0);
  await contexto.close();
});

test("os botoes do trilho tem alvo de toque de 44px ou mais", async ({
  page,
}) => {
  // O mecanico usa luva. 44px e o piso; medido em pixel real, nao no CSS.
  const botoes = page.getByRole("navigation").getByRole("button");
  const total = await botoes.count();
  expect(total).toBeGreaterThan(0);
  for (let i = 0; i < total; i += 1) {
    const caixa = await botoes.nth(i).boundingBox();
    expect(caixa, `botao ${i + 1} sem caixa`).not.toBeNull();
    const nome = await botoes.nth(i).getAttribute("aria-label");
    expect(caixa!.height, `"${nome}" tem ${caixa!.height}px de altura`).
      toBeGreaterThanOrEqual(44);
    expect(caixa!.width, `"${nome}" tem ${caixa!.width}px de largura`).
      toBeGreaterThanOrEqual(44);
  }
});
