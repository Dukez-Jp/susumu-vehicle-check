import { useEffect } from "react";

/* O facho de luz dos blocos do painel nasce em --mx / --my. O CSS sozinho não
   sabe onde o ponteiro está dentro do elemento, então quem escreve essas duas
   medidas é este gancho — uma única escuta no documento, não uma por bloco.

   Sem ele o painel continua inteiro: as duas medidas têm 50% como valor padrão
   no CSS, e o facho simplesmente nasce no centro. É o que acontece no tablet,
   onde não existe ponteiro pairando, e em quem pediu menos movimento ao
   sistema — aí a luz acende e apaga, mas não persegue nada. */

const ALVOS = ".bento .card, .vehicle-row, .draft-open";

export default function usePointerGlow() {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    // A posição só é gravada uma vez por quadro: mover o mouse dispara dezenas
    // de eventos por segundo e cada getBoundingClientRect força o navegador a
    // recalcular a página.
    let quadro = 0;
    let ultimo: PointerEvent | null = null;

    function aplicar() {
      quadro = 0;
      const evento = ultimo;
      if (!evento) return;
      const alvo = (evento.target as Element | null)?.closest?.(ALVOS);
      if (!(alvo instanceof HTMLElement)) return;
      const area = alvo.getBoundingClientRect();
      alvo.style.setProperty("--mx", `${evento.clientX - area.left}px`);
      alvo.style.setProperty("--my", `${evento.clientY - area.top}px`);
    }

    function mover(evento: PointerEvent) {
      ultimo = evento;
      if (!quadro) quadro = requestAnimationFrame(aplicar);
    }

    document.addEventListener("pointermove", mover, { passive: true });
    return () => {
      document.removeEventListener("pointermove", mover);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, []);
}
