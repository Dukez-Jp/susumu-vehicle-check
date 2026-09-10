import { describe, expect, it, vi } from "vitest";
import {
  STORAGE_KEY,
  emptyState,
  finalizeInspection,
  issues,
  items,
  loadState,
  newInspection,
  saveState,
  simulateSync,
  statusLabels,
  updateAnswer,
  vehicles,
  type DemoState,
  type Inspection,
  type Photo,
  type Status,
} from "./model";

const SIGNATURE = "data:image/png;base64,QUJDRA==";
const IMAGE = "data:image/png;base64,QUJD";

function original(id: string): Photo {
  return { id, name: `${id}.png`, dataUrl: IMAGE, kind: "Original" };
}

function annotation(id: string, originalId: string): Photo {
  return {
    id,
    name: `${id}.png`,
    dataUrl: "data:image/png;base64,WFla",
    kind: "Annotation",
    originalId,
  };
}

function draft(): Inspection {
  return newInspection(vehicles[0].id, vehicles[0].odometer, "Operador Demo");
}

/** Every item answered with a value inside the configured measurement range. */
function answered(base = draft(), status: Status = "OK"): Inspection {
  let inspection = base;
  for (const item of items) {
    inspection = updateAnswer(inspection, item.id, {
      status,
      value: item.unit ? "8" : "",
    });
  }
  return inspection;
}

function ready(): Inspection {
  return { ...answered(), signature: SIGNATURE };
}

function memoryStorage(seed?: string) {
  const cells = new Map<string, string>();
  if (seed !== undefined) cells.set(STORAGE_KEY, seed);
  return {
    cells,
    getItem: (key: string) => cells.get(key) ?? null,
    setItem: (key: string, value: string) => void cells.set(key, value),
  };
}

describe("catálogo sintético da demonstração", () => {
  it("expõe três veículos com o 714 primeiro e doze itens em quatro seções", () => {
    expect(vehicles).toHaveLength(3);
    expect(vehicles[0]).toMatchObject({ number: "714", odometer: 182450 });
    expect(new Set(vehicles.map((v) => v.id)).size).toBe(3);

    expect(items).toHaveLength(12);
    expect(new Set(items.map((i) => i.id)).size).toBe(12);
    expect([...new Set(items.map((i) => i.section))]).toEqual([
      "Exterior",
      "Pneus e rodas",
      "Motor e fluidos",
      "Cabine e segurança",
    ]);

    const measurements = items.filter((i) => i.unit);
    expect(measurements).toHaveLength(2);
    for (const measurement of measurements) {
      expect(typeof measurement.min).toBe("number");
      expect(typeof measurement.max).toBe("number");
      expect(measurement.min!).toBeLessThan(measurement.max!);
    }
    expect(items.some((i) => i.allowNA)).toBe(true);
    expect(items.some((i) => !i.allowNA)).toBe(true);
    expect(statusLabels).toEqual({
      OK: "OK",
      Attention: "Atenção",
      Repair: "Reparar",
      Critical: "Crítico",
      NotApplicable: "N/A",
    });
    expect(STORAGE_KEY).toBe("susumu.tenken.demo.v1");
  });

  it("cria uma inspeção em branco e recusa entradas inválidas", () => {
    const created = draft();
    expect(created.state).toBe("Draft");
    expect(created.sent).toBe(false);
    expect(created.finalizedAt).toBeUndefined();
    expect(created.signature).toBeUndefined();
    expect(Object.keys(created.answers).sort()).toEqual(
      items.map((i) => i.id).sort(),
    );
    for (const answer of Object.values(created.answers)) {
      expect(answer).toEqual({
        status: undefined,
        value: "",
        notes: "",
        photos: [],
      });
    }
    expect(Date.parse(created.startedAt)).not.toBeNaN();

    const [vehicle] = vehicles;
    expect(() => newInspection("inexistente", vehicle.odometer, "A")).toThrow();
    expect(() => newInspection(vehicle.id, vehicle.odometer, "   ")).toThrow();
    expect(() =>
      newInspection(vehicle.id, vehicle.odometer - 1, "A"),
    ).toThrow();
    expect(() => newInspection(vehicle.id, 1.5, "A")).toThrow();
    expect(() => newInspection(vehicle.id, Number.NaN, "A")).toThrow();
    expect(() =>
      newInspection(vehicle.id, Number.POSITIVE_INFINITY, "A"),
    ).toThrow();
    expect(newInspection(vehicle.id, vehicle.odometer + 10, "A").odometer).toBe(
      vehicle.odometer + 10,
    );
  });

  it("mantém identidade e odômetro separados por veículo", () => {
    const first = newInspection(vehicles[0].id, vehicles[0].odometer, "A");
    const second = newInspection(vehicles[1].id, vehicles[1].odometer, "B");
    expect(first.id).not.toBe(second.id);
    expect(first.vehicleId).not.toBe(second.vehicleId);
    expect(second.odometer).toBe(vehicles[1].odometer);
    expect(() =>
      newInspection(vehicles[1].id, vehicles[0].odometer, "B"),
    ).not.toThrow();
    expect(() => newInspection(vehicles[2].id, 0, "C")).toThrow();
  });
});

describe("pendências antes de finalizar", () => {
  it("lista cada item sem resposta e não deixa finalizar em branco", () => {
    const problems = issues(draft());
    for (const item of items) {
      expect(problems.join("\n")).toContain(item.label);
    }
    expect(problems.length).toBeGreaterThanOrEqual(items.length);
    expect(() => finalizeInspection(draft())).toThrow();
  });

  it("recusa status desconhecido e N/A onde não é permitido", () => {
    const allowed = items.find((i) => i.allowNA)!;
    const forbidden = items.find((i) => !i.allowNA)!;

    const disallowed = updateAnswer(answered(), forbidden.id, {
      status: "NotApplicable",
    });
    expect(issues(disallowed).join("\n")).toContain(forbidden.label);
    expect(issues(disallowed).join("\n")).toMatch(/N\/A/i);

    const permitted = updateAnswer(answered(), allowed.id, {
      status: "NotApplicable",
      value: "",
    });
    expect(issues({ ...permitted, signature: SIGNATURE })).toEqual([]);

    const unknown = updateAnswer(answered(), forbidden.id, {
      status: "Aprovado" as Status,
    });
    expect(issues(unknown).join("\n")).toMatch(/desconhecid/i);
  });

  it("aceita sulco baixo e zero, recusa negativo, lixo e separador ambíguo", () => {
    const measurement = items.find((i) => i.unit && !i.allowNA)!;
    const optional = items.find((i) => i.unit && i.allowNA)!;

    // Pneu realmente gasto precisa ser registrável: o limite é plausibilidade,
    // não diagnóstico. Vírgula decimal é a digitação normal em português.
    expect(measurement.min).toBe(0);
    expect(optional.min).toBe(0);
    for (const value of [
      "0",
      "0,0",
      "0.0",
      "1,6",
      "1.6",
      "3,25",
      "20",
      "20,0",
    ]) {
      const good = updateAnswer(ready(), measurement.id, { value });
      expect(issues(good), value).toEqual([]);
      // O texto digitado é preservado como veio, sem reescrita silenciosa.
      expect(good.answers[measurement.id].value, value).toBe(value);
    }

    for (const value of [
      "",
      "   ",
      "-3",
      "-0,1",
      "abc",
      "1,5.2",
      "1.5,2",
      "1,234,5",
      "1 5",
      "1e3",
      "1,",
      ",5",
      "1.6mm",
      String(measurement.max! + 1),
      "20,1",
    ]) {
      const bad = updateAnswer(ready(), measurement.id, { value });
      expect(issues(bad).join("\n"), value).toContain(measurement.label);
      expect(bad.answers[measurement.id].value, value).toBe(value);
    }
    expect(issues(ready())).toEqual([]);

    // N/A permitido dispensa a medição, mas apenas para o item que permite.
    const skipped = updateAnswer(ready(), optional.id, {
      status: "NotApplicable",
      value: "",
    });
    expect(issues(skipped)).toEqual([]);
    const notSkipped = updateAnswer(ready(), measurement.id, {
      status: "Critical",
      value: "",
    });
    expect(issues(notSkipped).join("\n")).toContain(measurement.label);
  });

  it("exige assinatura e odômetro coerente nesta demonstração", () => {
    expect(issues(answered()).join("\n")).toMatch(/assinatura/i);
    expect(issues({ ...answered(), signature: "   " }).join("\n")).toMatch(
      /assinatura/i,
    );
    expect(issues({ ...answered(), signature: "rabisco" }).join("\n")).toMatch(
      /assinatura/i,
    );
    expect(issues(ready())).toEqual([]);

    expect(issues({ ...ready(), odometer: -1 }).join("\n")).toMatch(
      /quilometragem/i,
    );
    expect(issues({ ...ready(), odometer: 10.5 }).join("\n")).toMatch(
      /quilometragem/i,
    );
    expect(
      issues({ ...ready(), odometer: vehicles[0].odometer - 1 }).join("\n"),
    ).toMatch(/quilometragem/i);
    expect(issues({ ...ready(), vehicleId: "sumiu" }).join("\n")).toMatch(
      /ve[íi]culo/i,
    );
  });
});

describe("finalização e imutabilidade", () => {
  it("finaliza uma vez, congela o registro e recusa nova finalização", () => {
    const before = ready();
    const finalized = finalizeInspection(before);

    expect(before.state).toBe("Draft");
    expect(before.finalizedAt).toBeUndefined();
    expect(finalized).not.toBe(before);
    expect(finalized.state).toBe("Finalized");
    expect(finalized.sent).toBe(false);
    expect(Date.parse(finalized.finalizedAt!)).not.toBeNaN();
    expect(finalized.answers).not.toBe(before.answers);

    expect(() => finalizeInspection(finalized)).toThrow();
    expect(() =>
      updateAnswer(finalized, items[0].id, { notes: "depois" }),
    ).toThrow();
    expect(finalized.answers[items[0].id].notes).toBe("");
  });

  it("aplica alterações sem tocar na cópia anterior nem em item desconhecido", () => {
    const base = draft();
    const changed = updateAnswer(base, items[0].id, {
      status: "Repair",
      notes: "folga",
    });
    expect(base.answers[items[0].id]).toEqual({
      status: undefined,
      value: "",
      notes: "",
      photos: [],
    });
    expect(changed.answers[items[0].id]).toMatchObject({
      status: "Repair",
      notes: "folga",
    });
    expect(changed.answers[items[1].id]).toEqual(base.answers[items[1].id]);
    expect(() =>
      updateAnswer(base, "item-inexistente", { notes: "x" }),
    ).toThrow();
  });

  it("preserva a foto original ao acrescentar a cópia anotada", () => {
    const source = original("foto-1");
    const withPhoto = updateAnswer(draft(), items[0].id, { photos: [source] });
    const copy = annotation("foto-2", source.id);
    const withAnnotation = updateAnswer(withPhoto, items[0].id, {
      photos: [...withPhoto.answers[items[0].id].photos, copy],
    });

    const kept = withAnnotation.answers[items[0].id].photos;
    expect(kept).toHaveLength(2);
    expect(kept[0]).toEqual(source);
    expect(kept[0].dataUrl).toBe(IMAGE);
    expect(kept[1]).toMatchObject({
      kind: "Annotation",
      originalId: source.id,
    });
    expect(withPhoto.answers[items[0].id].photos).toHaveLength(1);
    expect(withAnnotation.answers[items[0].id].photos).not.toBe(
      withPhoto.answers[items[0].id].photos,
    );
  });

  it("recusa cópia anotada órfã, encadeada ou repetida antes de finalizar", () => {
    const source = original("foto-1");
    const target = items[0];
    const withSets = (photos: Photo[]) =>
      updateAnswer(ready(), target.id, { photos });

    expect(issues(withSets([source, annotation("foto-2", source.id)]))).toEqual(
      [],
    );

    const orphan = withSets([annotation("foto-2", "nao-existe")]);
    expect(issues(orphan).join("\n")).toContain(target.label);
    expect(issues(orphan).join("\n")).toMatch(/original/i);
    expect(() => finalizeInspection(orphan)).toThrow();

    // Anotação de anotação não recria o vínculo com a original.
    const chained = withSets([
      source,
      annotation("foto-2", source.id),
      annotation("foto-3", "foto-2"),
    ]);
    expect(issues(chained).join("\n")).toMatch(/original/i);

    const selfReferencing = withSets([source, annotation("foto-2", "foto-2")]);
    expect(issues(selfReferencing).join("\n")).toMatch(/original/i);

    const duplicated = withSets([source, original("foto-1")]);
    expect(issues(duplicated).join("\n")).toMatch(/repetida/i);
  });
});

describe("persistência local e envio simulado", () => {
  it("sobrevive a um recarregamento da página", () => {
    const storage = memoryStorage();
    const state: DemoState = {
      version: 1,
      inspections: [finalizeInspection(ready()), draft()],
    };
    saveState(storage, state);
    expect(storage.cells.has(STORAGE_KEY)).toBe(true);
    expect(loadState(storage)).toEqual(state);
    expect(loadState(memoryStorage())).toEqual(emptyState());
    expect(emptyState()).toEqual({ version: 1, inspections: [] });
  });

  it("não anuncia sucesso quando o navegador recusa gravar", () => {
    const full = {
      setItem: vi.fn(() => {
        throw new DOMException("quota", "QuotaExceededError");
      }),
    };
    expect(() => saveState(full, emptyState())).toThrow();
    expect(full.setItem).toHaveBeenCalledTimes(1);
  });

  it("recusa conteúdo inválido sem apagar nem reescrever o que já existe", () => {
    const corrupt = [
      "{",
      "null",
      '"texto"',
      '{"version":2,"inspections":[]}',
      '{"version":1}',
      '{"version":1,"inspections":{}}',
      '{"version":1,"inspections":[{"id":"a"}]}',
      '{"version":1,"inspections":[{"id":"a","vehicleId":"v-714","odometer":1,"operator":"A","startedAt":"x","state":"Draft","sent":false,"answers":null}]}',
    ];
    for (const raw of corrupt) {
      const storage = memoryStorage(raw);
      expect(() => loadState(storage), raw).toThrow();
      expect(storage.cells.get(STORAGE_KEY), raw).toBe(raw);
    }

    const good = finalizeInspection(ready());
    const encode = (inspection: unknown) =>
      JSON.stringify({ version: 1, inspections: [inspection] });

    expect(() =>
      loadState(memoryStorage(encode({ ...good, state: "Enviada" }))),
    ).toThrow();
    expect(() =>
      loadState(memoryStorage(encode({ ...good, finalizedAt: undefined }))),
    ).toThrow();
    expect(() =>
      loadState(memoryStorage(encode({ ...good, signature: "rabisco" }))),
    ).toThrow();
    expect(() =>
      loadState(
        memoryStorage(
          encode({
            ...good,
            answers: {
              [items[0].id]: {
                status: "Aprovado",
                value: "",
                notes: "",
                photos: [],
              },
            },
          }),
        ),
      ),
    ).toThrow();
    expect(() =>
      loadState(
        memoryStorage(
          encode({
            ...good,
            answers: {
              [items[0].id]: {
                value: "",
                notes: "",
                photos: [
                  {
                    id: "p",
                    name: "p",
                    dataUrl: "javascript:1",
                    kind: "Original",
                  },
                ],
              },
            },
          }),
        ),
      ),
    ).toThrow();
    expect(() =>
      loadState(
        memoryStorage(
          encode({
            ...good,
            answers: {
              [items[0].id]: {
                value: "",
                notes: "",
                photos: [{ ...annotation("a", "b"), originalId: undefined }],
              },
            },
          }),
        ),
      ),
    ).toThrow();

    // Vínculo de foto guardado precisa continuar coerente após o recarregamento.
    const broken = [
      [annotation("a", "sumiu")],
      [original("a"), original("a")],
      [original("a"), annotation("b", "a"), annotation("c", "b")],
    ];
    for (const photos of broken) {
      expect(
        () =>
          loadState(
            memoryStorage(
              encode({
                ...good,
                answers: {
                  [items[0].id]: { value: "", notes: "", photos },
                },
              }),
            ),
          ),
        JSON.stringify(photos),
      ).toThrow();
    }
  });

  it("marca como enviada apenas a inspeção finalizada", () => {
    const pending = draft();
    const finalized = finalizeInspection(ready());
    const state: DemoState = { version: 1, inspections: [pending, finalized] };
    const synced = simulateSync(state);

    expect(synced).not.toBe(state);
    expect(state.inspections[1].sent).toBe(false);
    expect(synced.inspections[0]).toEqual(pending);
    expect(synced.inspections[0].sent).toBe(false);
    expect(synced.inspections[1].sent).toBe(true);
    expect(synced.inspections[1].state).toBe("Finalized");
    expect(simulateSync(synced).inspections[1].sent).toBe(true);
    expect(loadState(memoryStorage(JSON.stringify(synced)))).toEqual(synced);
  });
});
