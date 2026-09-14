import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";

export default function DrawingPad({
  background,
  onSave,
  onCancel,
}: {
  background?: string;
  onSave: (data: string) => boolean;
  onCancel: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const strokes = useRef(0);
  const submitting = useRef(false);
  const [ready, setReady] = useState(!background);
  const [marked, setMarked] = useState(false);
  const [failure, setFailure] = useState("");
  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    if (background) {
      let active = true;
      const photo = new Image();
      photo.onload = () => {
        if (!active) return;
        const scale = Math.min(
          c.width / photo.naturalWidth,
          c.height / photo.naturalHeight,
        );
        const width = photo.naturalWidth * scale,
          height = photo.naturalHeight * scale;
        ctx.drawImage(
          photo,
          (c.width - width) / 2,
          (c.height - height) / 2,
          width,
          height,
        );
        setReady(true);
      };
      photo.onerror = () => {
        if (active)
          setFailure(
            "Não foi possível abrir a foto. O original foi preservado.",
          );
      };
      photo.src = background;
      return () => {
        active = false;
      };
    }
  }, [background]);
  function point(e: PointerEvent<HTMLCanvasElement>) {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    return [
      ((e.clientX - r.left) * c.width) / r.width,
      ((e.clientY - r.top) * c.height) / r.height,
    ];
  }
  return (
    <div className="drawing-pad">
      <p>
        {background
          ? "Arraste o mouse para marcar a foto. O original será preservado."
          : "Segure o botão do mouse e desenhe sua assinatura de teste."}
      </p>
      {failure && <p role="alert">{failure}</p>}
      <canvas
        ref={canvas}
        width={900}
        height={background ? 560 : 240}
        aria-label={
          background ? "Área para anotar foto" : "Área para desenhar assinatura"
        }
        onPointerDown={(e) => {
          if (!ready || e.button !== 0) return;
          const ctx = e.currentTarget.getContext("2d")!;
          const [x, y] = point(e);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.strokeStyle = background ? "#de301f" : "#153d43";
          ctx.lineWidth = background ? 7 : 3;
          ctx.lineCap = "round";
          drawing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext("2d")!;
          const [x, y] = point(e);
          ctx.lineTo(x, y);
          ctx.stroke();
          strokes.current++;
          if (strokes.current >= 3) setMarked(true);
        }}
        onPointerUp={() => {
          drawing.current = false;
        }}
        onPointerCancel={() => {
          drawing.current = false;
        }}
      />
      <div className="actions">
        <button
          className="primary"
          disabled={!ready || !marked}
          onClick={() => {
            if (submitting.current) return;
            submitting.current = true;
            if (!onSave(canvas.current!.toDataURL("image/png"))) {
              submitting.current = false;
              setFailure(
                "Não foi possível salvar. O desenho continua nesta janela. Cancele para conferir o aviso de armazenamento ou tente salvar novamente.",
              );
            }
          }}
        >
          {background ? "Salvar cópia anotada" : "Salvar assinatura"}
        </button>
        <button onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}
