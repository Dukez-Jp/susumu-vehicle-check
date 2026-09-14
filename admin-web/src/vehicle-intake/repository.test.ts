import { describe, expect, it } from "vitest";
import { MLIT_ORIGINAL_FIELD_KEYS, type CaptureDraft } from "./capture";
import {
  CaptureStorageError,
  MAX_CAPTURE_RECORDS,
  MAX_STORAGE_BYTES,
  STORAGE_KEY,
  loadCaptures,
  saveCapture,
  type CaptureRecord,
} from "./repository";

function draft(overrides: Partial<CaptureDraft> = {}): CaptureDraft {
  return {
    source: "manual",
    fields: {
      plate: "DEMO-714",
      chassis: "DEMO-CHASSIS-714",
      manufacturer: "",
      model: "",
      engineModel: "",
      firstRegistration: "",
      validUntil: "",
      grossWeightKg: "",
      internalNumber: "714",
      odometerKm: "182450",
    },
    warnings: [],
    ...overrides,
  };
}

function memoryStorage(raw: string | null = null) {
  const values = new Map<string, string>();
  const writes: string[] = [];
  if (raw !== null) values.set(STORAGE_KEY, raw);
  return {
    values,
    writes,
    getItem: (key: string) => values.get(key) ?? null,
    setItem(key: string, value: string) {
      writes.push(key);
      values.set(key, value);
    },
  };
}

function storedRecord(index = 0): CaptureRecord {
  return {
    ...draft(),
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    capturedAt: "2026-09-10T12:00:00.000Z",
  };
}

function expectCode(action: () => unknown, code: string) {
  try {
    action();
    throw new Error("Expected storage operation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(CaptureStorageError);
    expect((error as CaptureStorageError).code).toBe(code);
  }
}

describe("coletas locais versionadas", () => {
  it("inicia vazio, sem escrever ou consultar registros de inspeção", () => {
    const storage = memoryStorage();
    storage.values.set("susumu.tenken.demo.v1", "histórico preservado");
    expect(loadCaptures(storage)).toEqual({
      store: { version: 1, records: [] },
      raw: null,
    });
    const result = saveCapture(storage, null, draft());
    expect(result.duplicate).toBe(false);
    expect(result.record.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(new Date(result.record.capturedAt).toISOString()).toBe(
      result.record.capturedAt,
    );
    expect(loadCaptures(storage).store.records).toEqual([result.record]);
    expect(storage.values.get("susumu.tenken.demo.v1")).toBe(
      "histórico preservado",
    );
    expect(storage.writes).toEqual([STORAGE_KEY]);
  });

  it("rejeita versão futura e dados corrompidos sem substituir armazenamento", () => {
    for (const raw of [
      "",
      "{broken",
      "null",
      JSON.stringify({ version: 2, records: [] }),
      JSON.stringify({ version: 1, records: {} }),
      JSON.stringify({
        version: 1,
        records: [{ ...storedRecord(), id: "714" }],
      }),
      JSON.stringify({
        version: 1,
        records: [{ ...storedRecord(), capturedAt: "2026-02-30" }],
      }),
      JSON.stringify({ version: 1, records: [storedRecord(), storedRecord()] }),
      JSON.stringify({
        version: 1,
        records: [{ ...storedRecord(), source: "nfc" }],
      }),
      JSON.stringify({
        version: 1,
        records: [{ ...storedRecord(), fields: { plate: "DEMO" } }],
      }),
    ]) {
      const storage = memoryStorage(raw);
      expectCode(() => loadCaptures(storage), "CORRUPT_STORAGE");
      expectCode(() => saveCapture(storage, raw, draft()), "CORRUPT_STORAGE");
      expect(storage.getItem(STORAGE_KEY)).toBe(raw);
      expect(storage.writes).toEqual([]);
    }
  });

  it("não aceita valores cadastrais inválidos", () => {
    const storage = memoryStorage();
    const invalid = draft();
    invalid.fields.plate = "";
    expectCode(() => saveCapture(storage, null, invalid), "INVALID_CAPTURE");
    expect(storage.writes).toEqual([]);
    const raw = JSON.stringify({
      version: 1,
      records: [{ ...storedRecord(), fields: invalid.fields }],
    });
    expectCode(() => loadCaptures(memoryStorage(raw)), "CORRUPT_STORAGE");
  });

  it("só persiste a estrutura contratada e originais oficiais permitidos", () => {
    const storage = memoryStorage();
    const input = {
      ...draft({ source: "mlit-json", sourceVersion: "1.2" }),
      fields: { ...draft().fields, owner: "NÃO GUARDAR" },
      originalFields: {
        CarNo: "DEMO-CHASSIS-714",
        OwnerName: "NÃO GUARDAR",
        AccessKey: "NÃO GUARDAR",
        SecurityCode: "1234",
      },
      raw: "NÃO GUARDAR",
      accessKey: "NÃO GUARDAR",
    };
    const result = saveCapture(storage, null, input);
    expect(result.record.originalFields).toEqual({ CarNo: "DEMO-CHASSIS-714" });
    expect(result.raw).not.toContain("NÃO GUARDAR");
    expect(result.raw).not.toContain("SecurityCode");
    expect(result.record.fields).toEqual(draft().fields);
  });

  it("rejeita estrutura persistida com campos extras, preservando o original", () => {
    const raw = JSON.stringify({
      version: 1,
      records: [{ ...storedRecord(), rawOwner: "dado inesperado" }],
    });
    const storage = memoryStorage(raw);
    expectCode(() => loadCaptures(storage), "CORRUPT_STORAGE");
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("deduplica campos, fonte e originais mesmo com ordem de chaves diferente", () => {
    const storage = memoryStorage();
    const initial = draft({
      source: "mlit-json",
      sourceVersion: "1.2",
      originalFields: { CarNo: "DEMO-CHASSIS-714", CarName: "デモ" },
    });
    const first = saveCapture(storage, null, initial);
    const second = saveCapture(storage, first.raw, {
      ...initial,
      originalFields: { CarName: "デモ", CarNo: "DEMO-CHASSIS-714" },
      warnings: ["novo aviso"],
    });
    expect(second.duplicate).toBe(true);
    expect(second.record).toEqual(first.record);
    expect(second.raw).toBe(first.raw);
    expect(second.store.records).toHaveLength(1);
    expect(storage.writes).toHaveLength(1);
  });

  it("identifica repetição antiga sem apagar as coletas posteriores", () => {
    const storage = memoryStorage();
    const first = saveCapture(storage, null, draft());
    const changed = draft();
    changed.fields.model = "MODELO-DEMO";
    const second = saveCapture(storage, first.raw, changed);
    const repeated = saveCapture(storage, second.raw, draft());
    expect(repeated.duplicate).toBe(true);
    expect(repeated.record.id).toBe(first.record.id);
    expect(repeated.store.records).toEqual([first.record, second.record]);
    expect(repeated.raw).toBe(second.raw);
  });

  it("mudança no mesmo chassi acrescenta coleta e deixa histórico intacto", () => {
    const storage = memoryStorage();
    const input = draft();
    const first = saveCapture(storage, null, input);
    input.fields.validUntil = "2028-09-10";
    const second = saveCapture(storage, first.raw, input);
    expect(second.duplicate).toBe(false);
    expect(second.record.id).not.toBe(first.record.id);
    expect(second.store.records).toEqual([first.record, second.record]);
    expect(first.record.fields.validUntil).toBe("");
    expect(second.record.fields.validUntil).toBe("2028-09-10");
    input.fields.model = "alteração após salvar";
    expect(second.record.fields.model).toBe("");
    expect(loadCaptures(storage).store.records).toEqual(second.store.records);
  });

  it("fonte, versão e originais diferentes mantêm proveniências distintas", () => {
    const storage = memoryStorage();
    let raw: string | null = null;
    for (const input of [
      draft(),
      draft({ source: "mlit-json", sourceVersion: "1.2" }),
      draft({ source: "mlit-json", sourceVersion: "1.3" }),
      draft({
        source: "mlit-json",
        sourceVersion: "1.3",
        originalFields: { CarNo: "DEMO-CHASSIS-714" },
      }),
    ]) {
      const saved = saveCapture(storage, raw, input);
      expect(saved.duplicate).toBe(false);
      raw = saved.raw;
    }
    expect(loadCaptures(storage).store.records).toHaveLength(4);
  });

  it("conflito entre abas preserva a gravação mais recente até recarregar", () => {
    const storage = memoryStorage();
    const first = saveCapture(storage, null, draft());
    expectCode(() => saveCapture(storage, null, draft()), "STORAGE_CONFLICT");
    expect(storage.getItem(STORAGE_KEY)).toBe(first.raw);
    expect(storage.writes).toHaveLength(1);
  });

  it("reconfere armazenamento imediatamente antes de gravar", () => {
    const storage = memoryStorage();
    let reads = 0;
    const changing = {
      getItem: () => (++reads === 1 ? null : "outra aba escreveu"),
      setItem: storage.setItem,
    };
    expectCode(() => saveCapture(changing, null, draft()), "STORAGE_CONFLICT");
    expect(storage.writes).toEqual([]);
  });

  it("falha de quota ou armazenamento não anuncia sucesso nem apaga dados", () => {
    for (const [error, code] of [
      [
        new DOMException("cheio", "QuotaExceededError"),
        "STORAGE_QUOTA_EXCEEDED",
      ],
      [new Error("negado"), "STORAGE_WRITE_FAILED"],
    ] as const) {
      const storage = memoryStorage();
      const first = saveCapture(storage, null, draft());
      const changed = draft();
      changed.fields.model = "ALTERADO";
      expectCode(
        () =>
          saveCapture(
            {
              ...storage,
              setItem: () => {
                throw error;
              },
            },
            first.raw,
            changed,
          ),
        code,
      );
      expect(storage.getItem(STORAGE_KEY)).toBe(first.raw);
    }
  });

  it("traduz falha de leitura com código estável", () => {
    const storage = {
      getItem: () => {
        throw new Error("bloqueado");
      },
    };
    expectCode(() => loadCaptures(storage), "STORAGE_READ_FAILED");
  });

  it("limita mil coletas sem impedir consulta ou repetição já existente", () => {
    const records = Array.from({ length: MAX_CAPTURE_RECORDS }, (_, index) => {
      const record = storedRecord(index);
      record.fields.internalNumber = String(index);
      return record;
    });
    const raw = JSON.stringify({ version: 1, records });
    const storage = memoryStorage(raw);
    expect(loadCaptures(storage).store.records).toHaveLength(
      MAX_CAPTURE_RECORDS,
    );
    expect(saveCapture(storage, raw, records[0]).duplicate).toBe(true);
    const extra = draft();
    extra.fields.internalNumber = "EXTRA";
    expectCode(() => saveCapture(storage, raw, extra), "CAPTURE_LIMIT");
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    const excessive = JSON.stringify({
      version: 1,
      records: [...records, storedRecord(1001)],
    });
    expectCode(() => loadCaptures(memoryStorage(excessive)), "CAPTURE_LIMIT");
  });

  it("limita tamanho antes de analisar JSON e também antes de escrever", () => {
    const oversized = " ".repeat(MAX_STORAGE_BYTES / 2 + 1);
    expectCode(
      () => loadCaptures(memoryStorage(oversized)),
      "STORAGE_TOO_LARGE",
    );

    const large = draft({
      source: "mlit-json",
      originalFields: Object.fromEntries(
        MLIT_ORIGINAL_FIELD_KEYS.map((key) => [key, "あ".repeat(1024)]),
      ),
      warnings: Array.from({ length: 20 }, () => "あ".repeat(500)),
    });
    // Fixed-length UUIDs make each record the same size. Build the boundary
    // fixture once, avoiding quadratic multi-megabyte serializations in CI.
    const recordLength = JSON.stringify({ ...storedRecord(), ...large }).length;
    const envelopeLength = JSON.stringify({ version: 1, records: [] }).length;
    const count = Math.floor(
      (MAX_STORAGE_BYTES / 2 - envelopeLength + 1) / (recordLength + 1),
    );
    const records = Array.from({ length: count }, (_, index) => ({
      ...storedRecord(index),
      ...large,
    }));
    const raw = JSON.stringify({ version: 1, records });
    const storage = memoryStorage(raw);
    large.fields.model = "nova coleta";
    expectCode(() => saveCapture(storage, raw, large), "STORAGE_TOO_LARGE");
    expect(storage.writes).toEqual([]);
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });
});
