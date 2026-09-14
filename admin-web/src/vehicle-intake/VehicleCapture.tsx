import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  FileUp,
  Keyboard,
  Nfc,
  Plus,
  Save,
  Truck,
} from "lucide-react";
import { emptyCapture, parseMlitJson, validateCapture } from "./capture";
import type { CaptureDraft, VehicleCaptureFields } from "./capture";
import { loadCaptures, saveCapture } from "./repository";
import { messages } from "./messages";
import type { IntakeLanguage } from "./messages";
import LanguageSwitch from "../branding/LanguageSwitch";
import { loadLanguage, saveLanguage } from "../demo/language";
import "./vehicle-capture.css";
import BrandLogo from "../branding/BrandLogo";

type Method = "manual" | "file" | "nfc";
const fieldOrder: (keyof VehicleCaptureFields)[] = [
  "plate",
  "chassis",
  "manufacturer",
  "model",
  "engineModel",
  "internalNumber",
  "firstRegistration",
  "validUntil",
  "grossWeightKg",
  "odometerKm",
];

function codeOf(error: unknown): string {
  if (error instanceof Error) {
    if ("code" in error && typeof error.code === "string") return error.code;
    return error.message;
  }
  return "unknown";
}

function originalValues(
  original: Record<string, string>,
): Partial<VehicleCaptureFields> {
  const joined = (keys: string[]) =>
    keys
      .map((key) => original[key] ?? "")
      .filter(Boolean)
      .join(" ");
  return {
    plate: original.EntryNoCarNo,
    chassis: original.CarNo,
    manufacturer: original.CarName,
    model: original.Model,
    engineModel: original.EngineModel,
    grossWeightKg: original.CarTotalWgt,
    firstRegistration: joined(
      original.RegistCarLightCar?.normalize("NFKC").trim() === "02"
        ? ["FirstexamdateE", "FirstexamdateY", "FirstexamdateM"]
        : ["FirstregistdateE", "FirstregistdateY", "FirstregistdateM"],
    ),
    validUntil: joined([
      "ValidPeriodExpirdateE",
      "ValidPeriodExpirdateY",
      "ValidPeriodExpirdateM",
      "ValidPeriodExpirdateD",
    ]),
  };
}

export default function VehicleCapture({
  active,
  onBack,
  language: languageProp,
  onLanguageChange,
}: {
  active: boolean;
  onBack: () => void;
  /** Supplied by the shell so one choice governs every screen. */
  language?: IntakeLanguage;
  onLanguageChange?: (next: IntakeLanguage) => void;
}) {
  const [ownLanguage, setOwnLanguage] = useState<IntakeLanguage>(() =>
    loadLanguage(localStorage),
  );
  const language = languageProp ?? ownLanguage;
  function setLanguage(next: IntakeLanguage) {
    setOwnLanguage(next);
    saveLanguage(localStorage, next);
    onLanguageChange?.(next);
  }
  const t = messages[language];
  const [initial] = useState(() => {
    try {
      return { ...loadCaptures(localStorage), error: "" };
    } catch (error) {
      return {
        store: { version: 1 as const, records: [] },
        raw: null,
        error: codeOf(error),
      };
    }
  });
  const [store, setStore] = useState(initial.store);
  const raw = useRef(initial.raw);
  const [draft, setDraft] = useState<CaptureDraft>(emptyCapture);
  const [method, setMethod] = useState<Method>("manual");
  const [dirty, setDirty] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errorCode, setErrorCode] = useState("");
  const [notice, setNotice] = useState<
    "saved" | "duplicate" | "reviewRequired" | ""
  >("");
  const [busy, setBusy] = useState(false);
  const [candidate, setCandidate] = useState<CaptureDraft | null>(null);
  const [clearing, setClearing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (!active) return;
    const previous = document.documentElement.lang;
    document.documentElement.lang = language;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [active, language]);

  function applyDraft(next: CaptureDraft) {
    setDraft(next);
    setReviewed(false);
    setDirty(true);
    setFieldErrors({});
    setNotice("");
    setErrorCode("");
    setCandidate(null);
    setClearing(false);
  }
  function clear() {
    applyDraft(emptyCapture());
    setDirty(false);
    setMethod("manual");
  }
  async function importFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setErrorCode("");
    setNotice("");
    try {
      if (file.size > 1024 * 1024) throw new Error("file_too_large");
      const parsed = parseMlitJson(await file.text());
      if (dirty) setCandidate(parsed);
      else applyDraft(parsed);
    } catch (error) {
      setErrorCode(codeOf(error));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  function save() {
    setNotice("");
    setErrorCode("");
    const errors = validateCapture(draft.fields);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    if (!reviewed) {
      setNotice("reviewRequired");
      return;
    }
    try {
      const result = saveCapture(localStorage, raw.current, draft);
      raw.current = result.raw;
      setStore(result.store);
      setDirty(false);
      setNotice(result.duplicate ? "duplicate" : "saved");
    } catch (error) {
      setErrorCode(codeOf(error));
    }
  }

  return (
    <div className="vehicle-capture" lang={language} hidden={!active}>
      <header className="capture-header">
        <BrandLogo className="susumu-group-logo--compact" />
        <button onClick={onBack}>
          <ArrowLeft size={18} />
          {t.back}
        </button>
        <LanguageSwitch
          className="capture-language"
          language={language}
          onChange={setLanguage}
        />
      </header>
      <main className="capture-main">
        <div className="page-heading">
          <div>
            <span className="small-label">{t.preview}</span>
            <h1>
              <Truck size={30} /> {t.title}
            </h1>
            <p>{t.subtitle}</p>
          </div>
        </div>
        <p className="capture-scope">{t.scope}</p>
        {initial.error ? (
          <div className="alert danger" role="alert">
            {t.errors[initial.error] ?? t.errors.unknown}
          </div>
        ) : (
          <>
            <div className="capture-methods" role="group" aria-label={t.method}>
              {(
                [
                  ["manual", Keyboard],
                  ["file", FileUp],
                  ["nfc", Nfc],
                ] as const
              ).map(([value, Icon]) => (
                <button
                  key={value}
                  aria-pressed={method === value}
                  className={method === value ? "selected" : ""}
                  onClick={() => setMethod(value)}
                  disabled={busy}
                >
                  <Icon size={24} />
                  {t[value]}
                </button>
              ))}
            </div>
            <section className="panel capture-instructions">
              {method === "manual" && <p>{t.manualHelp}</p>}
              {method === "file" && (
                <>
                  <p>{t.fileHelp}</p>
                  <label className="capture-upload">
                    {t.choose}
                    <input
                      ref={fileInput}
                      type="file"
                      accept=".json,application/json"
                      disabled={busy}
                      onChange={(event) => {
                        void importFile(event.target.files?.[0]);
                      }}
                    />
                  </label>
                  {busy && <p role="status">{t.loading}</p>}
                </>
              )}
              {method === "nfc" && (
                <>
                  <span className="pill neutral">{t.nfcStatus}</span>
                  <h2>{t.nfcTitle}</h2>
                  <p>{t.nfcHelp}</p>
                  <ol>
                    {t.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <a
                    href="https://www.denshishakensho-portal.mlit.go.jp/business/application/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t.officialApp} ↗
                  </a>
                  <p className="capture-nfc-note">{t.nfcNote}</p>
                  <button onClick={() => setMethod("file")}>
                    <FileUp size={18} />
                    {t.file}
                  </button>
                </>
              )}
            </section>
            {candidate && (
              <section
                className="panel capture-pending"
                role="region"
                aria-label={t.pending}
              >
                <h2>{t.pending}</h2>
                <p>
                  {t.fieldLabels.plate}: {candidate.fields.plate} ·{" "}
                  {t.fieldLabels.chassis}: {candidate.fields.chassis}
                </p>
                <button
                  className="primary"
                  onClick={() => applyDraft(candidate)}
                >
                  {t.replace}
                </button>{" "}
                <button onClick={() => setCandidate(null)}>{t.cancel}</button>
              </section>
            )}
            {errorCode && (
              <div role="alert" className="alert danger">
                {t.errors[errorCode] ?? t.errors.unknown}
              </div>
            )}
            {notice && (
              <div role="status" className="alert info">
                {t[notice]}
              </div>
            )}
            <form
              className="panel capture-form"
              onSubmit={(event) => {
                event.preventDefault();
                save();
              }}
              noValidate
            >
              <div className="section-heading">
                <div>
                  <h2>{t.formTitle}</h2>
                  <p>
                    {draft.source === "manual" ? t.sourceManual : t.sourceFile}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => (dirty ? setClearing(true) : clear())}
                >
                  <Plus size={18} />
                  {t.fresh}
                </button>
              </div>
              {clearing && (
                <div role="alert" className="capture-clear">
                  <p>{t.discardQuestion}</p>
                  <button type="button" onClick={() => setClearing(false)}>
                    {t.keep}
                  </button>{" "}
                  <button type="button" onClick={clear}>
                    {t.discard}
                  </button>
                </div>
              )}
              <p>{t.optional}</p>
              {draft.warnings.length > 0 && (
                <div className="capture-warnings">
                  <p>{t.warningIntro}</p>
                  <ul>
                    {draft.warnings.map((warning) => (
                      <li key={warning}>
                        {t.warnings[warning] ?? t.issueIntro}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {Object.values(fieldErrors).some(Boolean) && (
                <p role="alert">{t.issueIntro}</p>
              )}
              <fieldset disabled={busy} className="capture-fields">
                {fieldOrder.map((key) => (
                  <label key={key} htmlFor={`capture-${key}`}>
                    <span id={`label-${key}`}>
                      {t.fieldLabels[key]}
                      {["plate", "chassis"].includes(key) ? " *" : ""}
                    </span>
                    <input
                      id={`capture-${key}`}
                      aria-labelledby={`label-${key}`}
                      value={draft.fields[key]}
                      maxLength={500}
                      inputMode={key === "odometerKm" ? "numeric" : undefined}
                      autoComplete="off"
                      aria-required={["plate", "chassis"].includes(key)}
                      aria-invalid={Boolean(fieldErrors[key])}
                      aria-describedby={
                        fieldErrors[key]
                          ? `error-${key}`
                          : [
                                "firstRegistration",
                                "validUntil",
                                "odometerKm",
                              ].includes(key)
                            ? `help-${key}`
                            : undefined
                      }
                      onChange={(event) => {
                        setDraft({
                          ...draft,
                          fields: {
                            ...draft.fields,
                            [key]: event.target.value,
                          },
                        });
                        setDirty(true);
                        setReviewed(false);
                        setNotice("");
                        setFieldErrors({ ...fieldErrors, [key]: "" });
                      }}
                    />
                    {key === "firstRegistration" && (
                      <small id={`help-${key}`}>{t.firstHelp}</small>
                    )}
                    {key === "validUntil" && (
                      <small id={`help-${key}`}>{t.validHelp}</small>
                    )}
                    {key === "odometerKm" && (
                      <small id={`help-${key}`}>{t.odoHelp}</small>
                    )}
                    {fieldErrors[key] && (
                      <small
                        className="capture-field-error"
                        id={`error-${key}`}
                      >
                        {t.errors[fieldErrors[key]] ?? t.errors.unknown}
                      </small>
                    )}
                  </label>
                ))}
              </fieldset>
              {draft.originalFields && (
                <details className="capture-original">
                  <summary>{t.original}</summary>
                  <dl>
                    {Object.entries(originalValues(draft.originalFields)).map(
                      ([key, value]) => (
                        <div key={key}>
                          <dt>
                            {t.fieldLabels[key as keyof VehicleCaptureFields]}
                          </dt>
                          <dd>{value || "—"}</dd>
                        </div>
                      ),
                    )}
                  </dl>
                </details>
              )}
              <label className="capture-review">
                <input
                  type="checkbox"
                  checked={reviewed}
                  disabled={busy}
                  onChange={(event) => setReviewed(event.target.checked)}
                />
                {t.review}
              </label>
              <div className="capture-save">
                <button
                  className="primary"
                  type="submit"
                  disabled={busy || Boolean(candidate)}
                >
                  <Save size={18} />
                  {t.save}
                </button>
                {dirty && <span>{t.unsaved}</span>}
              </div>
            </form>
            <section className="panel capture-history">
              <h2>
                {t.savedTitle}{" "}
                <span className="pill neutral">{store.records.length}</span>
              </h2>
              {store.records.length === 0 ? (
                <p>{t.none}</p>
              ) : (
                <div className="capture-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{t.fieldLabels.plate}</th>
                        <th>{t.fieldLabels.chassis}</th>
                        <th>{t.method}</th>
                        <th>{t.collectedAt}</th>
                        <th aria-label={t.open} />
                      </tr>
                    </thead>
                    <tbody>
                      {[...store.records].reverse().map((record) => (
                        <tr key={record.id}>
                          <td>{record.fields.plate}</td>
                          <td>{record.fields.chassis}</td>
                          <td>
                            {record.source === "manual"
                              ? t.manualShort
                              : t.fileShort}
                          </td>
                          <td>
                            {new Date(record.capturedAt).toLocaleString(
                              language,
                            )}
                          </td>
                          <td>
                            <button
                              disabled={busy}
                              onClick={() => {
                                const next: CaptureDraft = {
                                  fields: { ...record.fields },
                                  source: record.source,
                                  sourceVersion: record.sourceVersion,
                                  originalFields: record.originalFields,
                                  warnings: record.warnings,
                                };
                                if (dirty) setCandidate(next);
                                else applyDraft(next);
                              }}
                            >
                              {t.open}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
