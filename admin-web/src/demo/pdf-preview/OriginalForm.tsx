import source from "../../../../docs/source/tenken-20260910/catalogo_pdf_100_itens.json";
import { estimatedTextWidth, preparePrint } from "./print";
import { PAGE_HEIGHT, PAGE_WIDTH, sampleNoticeBox } from "./print-layout";
import { printSymbols, type PreviewState } from "./state";
import type { MeasurementSession } from "../../measurements/model";
import { prepareMeasurementSummary } from "../../measurements/print";

const FONT_FAMILY = 'Meiryo, "Yu Gothic", sans-serif';

export default function OriginalForm({
  state,
  measurementSession,
}: {
  state: PreviewState;
  measurementSession?: MeasurementSession;
}) {
  const { fields } = preparePrint(state);
  const measurement = measurementSession
    ? prepareMeasurementSummary(measurementSession)
    : null;
  let unanswered = 0;
  let attention = 0;
  for (const answer of Object.values(state.answers)) {
    if (answer.result === "") unanswered += 1;
    if (answer.result === "attention") attention += 1;
  }

  return (
    <svg
      className="pdf-original-form"
      viewBox={`0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="点検整備記録簿の見本・未確定"
      lang="ja"
      fontFamily={FONT_FAMILY}
      fill="#000"
    >
      <title>点検整備記録簿の見本・未確定</title>
      <image
        href="/tenken/original.png"
        x="0"
        y="0"
        width={PAGE_WIDTH}
        height={PAGE_HEIGHT}
      />
      <text
        x={sampleNoticeBox.x + sampleNoticeBox.width}
        y={sampleNoticeBox.y + sampleNoticeBox.fontSize}
        fontSize={sampleNoticeBox.fontSize}
        textAnchor="end"
        fontWeight="bold"
      >
        見本・未確定
      </text>
      <text x="305" y="22" fontSize="8">
        未記入 {unanswered}
        {"\u3000"}要確認 {attention}
      </text>
      {fields.map((field) => (
        <text
          key={`${field.key}-${field.box.x}-${field.box.y}`}
          data-print-field={field.key}
          fontSize={field.fontSize}
          dominantBaseline="text-before-edge"
          xmlSpace="preserve"
        >
          {field.lines.map((line, index) => (
            <tspan
              key={index}
              x={field.box.x}
              y={field.box.y + index * field.fontSize * 1.22}
              textLength={
                Math.min(
                  estimatedTextWidth(line, field.fontSize),
                  field.box.width,
                ) || undefined
              }
              lengthAdjust="spacingAndGlyphs"
            >
              {line}
            </tspan>
          ))}
        </text>
      ))}
      {measurement && !measurement.issue && (
        <text
          data-measurement-summary="true"
          x={measurement.box.x}
          y={measurement.box.y}
          fontSize={measurement.fontSize}
          dominantBaseline="text-before-edge"
          textLength={estimatedTextWidth(
            measurement.text,
            measurement.fontSize,
          )}
          lengthAdjust="spacingAndGlyphs"
        >
          {measurement.text}
        </text>
      )}
      {source.items.map((item) => {
        const [x0, y0, x1, y1] = item.responseBoxPt;
        const glyphs = Array.from(
          printSymbols(state.answers[item.id]).replace(/\s/g, ""),
        );
        const lines = glyphs.length ? [glyphs.slice(0, 4).join("")] : [];
        if (glyphs.length > 4) lines.push(glyphs.slice(4).join(""));
        const fontSize = glyphs.length > 1 ? 6 : 9;
        const lineHeight = fontSize * 1.08;
        const centerX = (x0 + x1) / 2;
        const firstY = (y0 + y1) / 2 - ((lines.length - 1) * lineHeight) / 2;
        return (
          <g key={item.id} data-response-id={item.id}>
            {lines.length ? (
              <text
                fontSize={fontSize}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {lines.map((line, index) => (
                  <tspan
                    key={index}
                    x={centerX}
                    y={firstY + index * lineHeight}
                    textLength={Math.min(
                      estimatedTextWidth(line, fontSize),
                      x1 - x0 - 2,
                    )}
                    lengthAdjust="spacingAndGlyphs"
                  >
                    {line}
                  </tspan>
                ))}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
