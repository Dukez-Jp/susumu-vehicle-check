import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import DemoApp from "./DemoApp";
import { LANGUAGE_STORAGE_KEY } from "./language";

/* A demonstracao tem dois tipos de tela. Fila e Historico vivem dentro do
   mesmo shell e mantem o trilho a vista. Coletar, Medicoes e os 100 itens do
   PDF ocupam a tela inteira, escondem o trilho de proposito e trazem a
   propria saida. Os dois contratos precisam continuar valendo: quem entra
   consegue voltar, e o trilho oferece uma Oficina so. */
describe("navegacao do shell", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "pt-BR");
  });
  /* Abrir Medicoes ou o PDF escreve o hash na URL, e o jsdom guarda esse hash
     entre testes. Sem limpar, o teste seguinte abre na tela cheia em vez da
     oficina e falha por um motivo que nao tem a ver com ele. */
  afterEach(() => {
    window.history.replaceState(null, "", window.location.pathname);
  });

  it("mantem o trilho nas telas que vivem no shell", () => {
    render(<DemoApp />);
    for (const botao of [/Fila de envio/, /^Histórico$/]) {
      fireEvent.click(screen.getByRole("button", { name: botao }));
      fireEvent.click(screen.getByRole("button", { name: /Minha oficina/ }));
      expect(screen.getByText("Piloto · 1 tablet")).toBeInTheDocument();
    }
  });

  it("oferece uma Oficina so, nunca tres", () => {
    // O trilho ja mostrou Oficina, Oficina 2 e Oficina 3 lado a lado, para
    // comparar tratamentos de movimento. O mecanico precisa de uma entrada.
    render(<DemoApp />);
    expect(
      screen.getAllByRole("button", { name: /Minha oficina/ }),
    ).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /oficina 2/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /oficina 3/i })).toBeNull();
  });

  it("todo botao do trilho tem nome acessivel", () => {
    render(<DemoApp />);
    const nav = screen.getByRole("navigation");
    const botoes = Array.from(nav.querySelectorAll("button"));
    expect(botoes.length).toBeGreaterThan(0);
    for (const botao of botoes) {
      const nome = botao.getAttribute("aria-label") || botao.textContent?.trim();
      expect(nome, `botao sem nome acessivel: ${botao.outerHTML}`).toBeTruthy();
    }
  });

  const telaCheia = [
    "Coletar dados do caminhão",
    "Medições de pneus e freios",
    "Tenken do PDF · 100 itens",
  ];
  for (const destino of telaCheia) {
    it(`tem saida propria de "${destino}"`, () => {
      render(<DemoApp />);
      fireEvent.click(screen.getByRole("button", { name: destino }));
      // O trilho some de proposito nestas telas: sem saida propria, o
      // mecanico fica preso.
      expect(
        screen.queryAllByRole("button", { name: /Minha oficina/ }),
      ).toHaveLength(0);
      const saidas = screen.queryAllByRole("button", {
        name: /voltar|sair|fechar/i,
      });
      expect(
        saidas.length,
        `"${destino}" nao oferece saida`,
      ).toBeGreaterThan(0);
      fireEvent.click(saidas[0]);
      expect(screen.getByText("Piloto · 1 tablet")).toBeInTheDocument();
      expect(
        screen.getAllByRole("button", { name: /Minha oficina/ }),
      ).toHaveLength(1);
    });
  }

  it("guarda o idioma trocado dentro de uma tela cheia", () => {
    // As tres telas cheias recebem onLanguageChange. Se uma nao propagar, o
    // mecanico troca o idioma e ele volta atras sozinho.
    render(<DemoApp />);
    fireEvent.click(
      screen.getByRole("button", { name: "Medições de pneus e freios" }),
    );
    const japones = screen.queryAllByRole("button", { name: /日本語|Japon/i });
    expect(japones.length, "sem troca de idioma nessa tela").toBeGreaterThan(0);
    fireEvent.click(japones[0]);
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("ja");
  });

  it("percorre uma inspecao ate os 12 de 12", () => {
    render(<DemoApp />);
    fireEvent.click(screen.getByRole("button", { name: /Inspecionar 714/ }));
    fireEvent.click(screen.getByRole("button", { name: "Iniciar Tenken" }));
    for (let i = 0; i < 12; i += 1) {
      const ok = screen.queryAllByRole("button", { name: "OK" })[0];
      if (!ok) break;
      fireEvent.click(ok);
      const proximo = screen.queryByRole("button", { name: /Próximo item/ });
      if (proximo) fireEvent.click(proximo);
    }
    expect(screen.getByText("12 de 12 respondidos")).toBeInTheDocument();
  });
});
