import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  ClipboardList,
  Download,
  FileText,
  Printer,
  Search,
} from "lucide-react";
import source from "../../../../docs/source/tenken-20260910/catalogo_pdf_100_itens.json";
import BrandLogo from "../../branding/BrandLogo";
import {
  emptyPreview,
  loadPreview,
  MAX_HEADER_LENGTH,
  MAX_NOTES_LENGTH,
  PreviewStorageError,
  savePreview,
  updatePreviewAnswer,
} from "./state";
import type { Action, HeaderFields, PreviewState, Result } from "./state";
import { footnotes, itemTranslations, sections } from "./translations";
import { messages } from "./messages";
import LanguageSwitch from "../../branding/LanguageSwitch";
import { loadLanguage, saveLanguage } from "../language";
import type { Language } from "./messages";
import OriginalForm from "./OriginalForm";
import { preparePrint } from "./print";
import type { MeasurementSession } from "../../measurements/model";
import { activeReadings } from "../../measurements/model";
import {
  measurementBindingValid,
  measurementPreviewStorage,
  seedMeasurementPreview,
} from "../../measurements/inspection";
import {
  getMetricPdfItemId,
  prepareMeasurementSummary,
} from "../../measurements/print";
import {
  messages as measurementMessages,
  formatMm,
  positionLabel,
  sourceLabel,
} from "../../measurements/messages";
import "./pdf-preview.css";

const actions: [Action, string][] = [
  ["specific", "○"],
  ["adjust", "A"],
  ["tighten", "T"],
  ["replace", "×"],
  ["repair", "△"],
  ["clean", "C"],
  ["lubricate", "L"],
];
const results: Result[] = ["checked", "attention", "notApplicable"];
const headerOrder: (keyof HeaderFields)[] = [
  "registration",
  "makeModel",
  "engineModel",
  "firstRegistration",
  "odometer",
  "inspectionMonths",
  "inspectionDate",
  "completionDate",
  "customer",
  "address",
  "workshopName",
  "workshopAddress",
  "accreditation",
  "inspector",
  "co",
  "hc",
];
const examples: Partial<HeaderFields> = {
  customer: "見本運送株式会社",
  address: "東京都（見本）",
  registration: "見本100あ0001",
  makeModel: "見本車両・DEMO-01",
  engineModel: "DEMO",
  firstRegistration: "2020-04",
  odometer: "123456",
  inspectionDate: "2026-09-10",
  inspectionMonths: "3",
  workshopName: "見本整備工場",
  workshopAddress: "東京都（見本）",
  inspector: "見本担当者",
};
function errorCode(error: unknown) {
  return error instanceof PreviewStorageError
    ? error.code
    : "STORAGE_WRITE_FAILED";
}

export default function PdfPreview({
  active,
  onBack,
  measurementSession,
  language: languageProp,
  onLanguageChange,
}: {
  active: boolean;
  onBack: () => void;
  measurementSession?: MeasurementSession;
  /** Supplied by the shell so one choice governs every screen. */
  language?: Language;
  onLanguageChange?: (next: Language) => void;
}) {
  const [initial] = useState(() => {
    try {
      const storage = measurementSession
        ? measurementPreviewStorage(localStorage, measurementSession)
        : localStorage;
      const loaded = loadPreview(storage);
      return {
        ...loaded,
        state:
          loaded.raw === null && measurementSession
            ? seedMeasurementPreview(measurementSession)
            : loaded.state,
        storage,
        error: "",
      };
    } catch {
      return {
        state: emptyPreview(),
        raw: null,
        storage: null,
        error: "CORRUPT_STORAGE",
      };
    }
  });
  const [state, setState] = useState(initial.state);
  const stateRef = useRef(state);
  const rawRef = useRef(initial.raw);
  const checklistRef = useRef<HTMLElement>(null);
  const [ownLanguage, setOwnLanguage] = useState<Language>(() =>
    loadLanguage(localStorage),
  );
  const language = languageProp ?? ownLanguage;
  function setLanguage(next: Language) {
    setOwnLanguage(next);
    saveLanguage(localStorage, next);
    onLanguageChange?.(next);
  }
  const [storageError, setStorageError] = useState("");
  const [sectionId, setSectionId] = useState("steering");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("all");
  const [view, setView] = useState<"list" | "form">("list");
  const [formImageReady, setFormImageReady] = useState(false);
  const t = messages[language];
  const mt = measurementMessages[language];
  const linkedReadings = measurementSession
    ? activeReadings(measurementSession)
    : [];
  const localeKey = language === "ja" ? "ja" : "pt";

  useEffect(() => {
    if (!active) return;
    document.body.classList.add("tenken-preview-active");
    return () => document.body.classList.remove("tenken-preview-active");
  }, [active]);
  useEffect(() => {
    if (!active) return;
    const image = new Image();
    image.onload = () => setFormImageReady(true);
    image.src = "/tenken/original.png";
    return () => {
      image.onload = null;
    };
  }, [active]);
  useEffect(() => {
    if (!storageError) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [storageError]);

  function persist(next: PreviewState) {
    if (initial.error || !initial.storage) return;
    stateRef.current = next;
    setState(next);
    try {
      rawRef.current = savePreview(initial.storage, rawRef.current, next);
      setStorageError("");
    } catch (error) {
      setStorageError(errorCode(error));
    }
  }
  function changeHeader(key: keyof HeaderFields, value: string) {
    persist({
      ...stateRef.current,
      header: { ...stateRef.current.header, [key]: value },
    });
  }
  function chooseSection(id: string) {
    setSectionId(id);
    checklistRef.current?.scrollIntoView?.({ block: "start" });
  }
  function changeResult(id: string, result: Result) {
    const current = stateRef.current;
    persist(
      updatePreviewAnswer(current, id, {
        result: current.answers[id].result === result ? "" : result,
      }),
    );
  }
  function changeAction(id: string, action: Action, selected: boolean) {
    const current = stateRef.current;
    const selectedActions = current.answers[id].actions;
    persist(
      updatePreviewAnswer(current, id, {
        actions: selected
          ? [...selectedActions, action]
          : selectedActions.filter((entry) => entry !== action),
      }),
    );
  }
  function fillExample() {
    const next = {
      ...stateRef.current,
      header: { ...stateRef.current.header },
    };
    for (const [key, value] of Object.entries(examples)) {
      if (!next.header[key as keyof HeaderFields])
        next.header[key as keyof HeaderFields] = value;
    }
    persist(next);
  }
  function downloadDraft() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(stateRef.current, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "susumu-tenken-modelo.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const answers = Object.values(state.answers);
  const answered = answers.filter((answer) => answer.result).length;
  const attention = answers.filter(
    (answer) => answer.result === "attention",
  ).length;
  const print = preparePrint(state);
  const bindingValid =
    !measurementSession || measurementBindingValid(state, measurementSession);
  const measurementSummary = measurementSession
    ? prepareMeasurementSummary(measurementSession)
    : null;
  const printable =
    !initial.error &&
    print.issues.length === 0 &&
    formImageReady &&
    bindingValid &&
    !measurementSummary?.issue;
  const normalizedQuery = query.trim().toLocaleLowerCase(language);
  const filtered = source.items.filter((item) => {
    const translation = itemTranslations[item.id];
    const text =
      language === "ja"
        ? `${item.componentJa} ${item.itemJa}`
        : `${translation.component} ${translation.label}`;
    return (
      (sectionId === "all" || translation.sectionId === sectionId) &&
      (period === "all" ||
        item.periodsMonthsFromPrintedLegend.includes(Number(period))) &&
      (!normalizedQuery ||
        `${item.id.slice(4)} ${text}`
          .toLocaleLowerCase(language)
          .includes(normalizedQuery))
    );
  });
  const sectionIndex = sections.findIndex(
    (section) => section.id === sectionId,
  );
  const title =
    sectionId === "all" ? t.all : sections[sectionIndex]?.[localeKey];
  const issueLabel = (key: string) =>
    key === "notes" ? t.notesJa : (t.fields[key as keyof HeaderFields] ?? key);

  return (
    <div className="pdf-preview" lang={language} hidden={!active}>
      <div className="pdf-screen">
        <header className="pdf-topbar">
          <div className="pdf-brand">
            <BrandLogo className="susumu-group-logo--compact" />
            <span>
              Susumu Service<strong>{t.badge}</strong>
            </span>
          </div>
          <div className="pdf-top-actions">
            <button
              type="button"
              onClick={onBack}
              disabled={!!measurementSession && !!storageError}
            >
              <ArrowLeft size={17} aria-hidden="true" />
              {t.back}
            </button>
            <LanguageSwitch
              className="pdf-language"
              language={language}
              onChange={setLanguage}
            />
          </div>
        </header>
        {initial.error ? (
          <main className="pdf-fatal">
            <p role="alert">{t.corrupt}</p>
          </main>
        ) : (
          <main className="pdf-main">
            <section className="pdf-heading">
              <div>
                <h1>{t.title}</h1>
                <p>{t.subtitle}</p>
              </div>
              <button
                type="button"
                className="pdf-primary"
                onClick={() => setView(view === "list" ? "form" : "list")}
              >
                {view === "list" ? (
                  <FileText size={20} aria-hidden="true" />
                ) : (
                  <ClipboardList size={20} aria-hidden="true" />
                )}
                {view === "list" ? t.form : t.list}
              </button>
            </section>
            {storageError ? (
              <div className="pdf-alert" role="alert">
                <p>
                  {storageError === "STORAGE_CONFLICT" ? t.conflict : t.unsaved}
                </p>
                <button type="button" onClick={downloadDraft}>
                  <Download size={17} aria-hidden="true" />
                  {t.export}
                </button>
                {storageError !== "STORAGE_CONFLICT" && (
                  <button
                    type="button"
                    onClick={() => persist(stateRef.current)}
                  >
                    {t.retry}
                  </button>
                )}
              </div>
            ) : (
              <p className="pdf-save-status">
                <Check size={15} aria-hidden="true" />
                {rawRef.current ? t.saved : t.ready}
              </p>
            )}
            <div className="pdf-progress-strip" aria-label={t.progress}>
              <div>
                <strong>
                  {answered}
                  <span> / 100</span>
                </strong>
                <span>{t.answered}</span>
              </div>
              <progress value={answered} max={100} aria-label={t.progress} />
              <div className="pdf-pending">
                <strong>{100 - answered}</strong>
                <span>{t.empty}</span>
              </div>
              <div className={attention ? "pdf-attention-count" : ""}>
                <strong>{attention}</strong>
                <span>{t.attention}</span>
              </div>
            </div>
            {measurementSession && (
              <div className="pdf-measurement-link">
                <p>
                  <strong>{mt.linked}</strong> ·{" "}
                  {measurementSession.registration} ·{" "}
                  {measurementSession.inspectionDate}
                </p>
                <p>{mt.noDiagnosis}</p>
              </div>
            )}
            {!bindingValid && (
              <p className="pdf-alert" role="alert">
                {mt.bindingError}
              </p>
            )}
            {measurementSummary?.issue && (
              <p className="pdf-alert" role="alert">
                {mt.pdfOverflow}
              </p>
            )}
            <details className="pdf-metadata">
              <summary>
                {t.metadata}
                <span>{state.header.registration || "—"}</span>
              </summary>
              <div className="pdf-example">
                <button type="button" onClick={fillExample}>
                  {t.example}
                </button>
                <p>{t.exampleHelp}</p>
              </div>
              <div className="pdf-fields">
                {headerOrder.map((key) => (
                  <label key={key}>
                    {t.fields[key]}
                    {key === "inspectionMonths" ? (
                      <select
                        value={state.header[key]}
                        onChange={(event) =>
                          changeHeader(key, event.target.value)
                        }
                      >
                        <option value="">{t.select}</option>
                        <option value="3">
                          {language === "ja" ? "3か月" : "3 meses"}
                        </option>
                        <option value="12">{t.annual}</option>
                      </select>
                    ) : (
                      <input
                        readOnly={
                          !!measurementSession &&
                          [
                            "registration",
                            "inspectionDate",
                            "odometer",
                            "inspector",
                          ].includes(key)
                        }
                        value={state.header[key]}
                        maxLength={MAX_HEADER_LENGTH}
                        type={
                          key === "firstRegistration"
                            ? "month"
                            : key.endsWith("Date")
                              ? "date"
                              : "text"
                        }
                        inputMode={
                          ["odometer", "co", "hc"].includes(key)
                            ? "decimal"
                            : undefined
                        }
                        onChange={(event) =>
                          changeHeader(key, event.target.value)
                        }
                      />
                    )}
                  </label>
                ))}
              </div>
            </details>
            {view === "list" ? (
              <div className="pdf-workspace">
                <nav className="pdf-group-nav" aria-label={t.groups}>
                  <h2>{t.groups}</h2>
                  <button
                    type="button"
                    aria-current={sectionId === "all" ? "true" : undefined}
                    onClick={() => chooseSection("all")}
                  >
                    <span>{t.all}</span>
                    <span>100</span>
                  </button>
                  {sections.map((section) => {
                    const groupItems = source.items.filter(
                      (item) =>
                        itemTranslations[item.id].sectionId === section.id,
                    );
                    const done = groupItems.filter(
                      (item) => state.answers[item.id].result,
                    ).length;
                    return (
                      <button
                        type="button"
                        key={section.id}
                        aria-current={
                          sectionId === section.id ? "true" : undefined
                        }
                        onClick={() => chooseSection(section.id)}
                      >
                        <span>{section[localeKey]}</span>
                        <span>
                          {done}/{groupItems.length}
                        </span>
                      </button>
                    );
                  })}
                  <a
                    href="/tenken/original.pdf"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileText size={16} aria-hidden="true" />
                    {t.source}
                  </a>
                </nav>
                <section
                  ref={checklistRef}
                  className="pdf-checklist"
                  aria-label={t.list}
                >
                  <div className="pdf-filters">
                    <label className="pdf-search">
                      <Search size={18} aria-hidden="true" />
                      <input
                        type="search"
                        aria-label={t.search}
                        placeholder={t.search}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                      />
                    </label>
                    <label>
                      {t.period}
                      <select
                        value={period}
                        onChange={(event) => setPeriod(event.target.value)}
                      >
                        <option value="all">{t.all}</option>
                        <option value="3">{t.quarterly}</option>
                        <option value="12">{t.annual}</option>
                      </select>
                    </label>
                  </div>
                  <p className="pdf-filter-help">{t.periodHelp}</p>
                  <div className="pdf-section-heading">
                    <h2>{title}</h2>
                    <span>
                      {filtered.length} /{" "}
                      {
                        source.items.filter(
                          (item) =>
                            sectionId === "all" ||
                            itemTranslations[item.id].sectionId === sectionId,
                        ).length
                      }
                    </span>
                  </div>
                  {filtered.length === 0 && (
                    <p className="pdf-no-matches">{t.noMatches}</p>
                  )}
                  {filtered.map((item) => {
                    const answer = state.answers[item.id];
                    const translation = itemTranslations[item.id];
                    const itemMeasurements = linkedReadings.filter(
                      (reading) =>
                        getMetricPdfItemId(reading.metric) === item.id,
                    );
                    return (
                      <article
                        key={item.id}
                        className={`pdf-item pdf-result-${answer.result || "empty"}`}
                        aria-labelledby={`${item.id}-title`}
                      >
                        <div className="pdf-item-copy">
                          <span className="pdf-item-number">
                            {item.id.slice(4)}
                          </span>
                          <div>
                            <p className="pdf-component">
                              {language === "ja"
                                ? item.componentJa
                                : translation.component}
                            </p>
                            <h3 id={`${item.id}-title`}>
                              {language === "ja"
                                ? item.itemJa
                                : translation.label}
                            </h3>
                            <div className="pdf-item-meta">
                              <span
                                className={
                                  item.responseCellStyle === "gray"
                                    ? "pdf-cycle shaded"
                                    : "pdf-cycle"
                                }
                              >
                                {item.responseCellStyle === "gray"
                                  ? t.quarterly
                                  : t.annual}
                              </span>
                              {item.footnoteRefs.map((ref) => (
                                <details className="pdf-footnote" key={ref}>
                                  <summary>
                                    {t.note} {ref.replace("※", "")}
                                  </summary>
                                  <p>{footnotes[ref][localeKey]}</p>
                                </details>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div
                          className="pdf-result-buttons"
                          role="group"
                          aria-label={`${t.item} ${item.id.slice(4)}`}
                        >
                          {results.map((result) => (
                            <button
                              type="button"
                              key={result}
                              aria-pressed={answer.result === result}
                              className={`pdf-choice-${result}`}
                              onClick={() => changeResult(item.id, result)}
                            >
                              {result === "checked" ? (
                                <Check size={18} aria-hidden="true" />
                              ) : result === "attention" ? (
                                <CircleAlert size={18} aria-hidden="true" />
                              ) : (
                                <span aria-hidden="true">／</span>
                              )}
                              {t.results[result]}
                            </button>
                          ))}
                        </div>
                        <details className="pdf-services">
                          <summary>
                            {t.actions}
                            {answer.actions.length > 0 && (
                              <span>{answer.actions.length}</span>
                            )}
                          </summary>
                          <p>{t.actionsHelp}</p>
                          <div>
                            {actions.map(([action, symbol]) => (
                              <label key={action}>
                                <input
                                  type="checkbox"
                                  checked={answer.actions.includes(action)}
                                  disabled={answer.result === "notApplicable"}
                                  onChange={(event) =>
                                    changeAction(
                                      item.id,
                                      action,
                                      event.target.checked,
                                    )
                                  }
                                />
                                <b>{symbol}</b>
                                {t.maintenance[action]}
                              </label>
                            ))}
                          </div>
                        </details>
                        {itemMeasurements.length > 0 && (
                          <details className="pdf-item-measurements">
                            <summary>
                              {mt.summary}: {itemMeasurements.length} ·{" "}
                              {mt.openSummary}
                            </summary>
                            <table>
                              <tbody>
                                {itemMeasurements.map((reading) => (
                                  <tr key={reading.id}>
                                    <td>
                                      {positionLabel(
                                        reading.position,
                                        language,
                                        reading.metric,
                                      )}
                                    </td>
                                    <td>
                                      {formatMm(reading.valueMm, language)} mm
                                    </td>
                                    <td>
                                      {sourceLabel(reading.source, language)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </details>
                        )}
                      </article>
                    );
                  })}
                  {sectionIndex >= 0 && (
                    <div className="pdf-group-paging">
                      <button
                        type="button"
                        disabled={sectionIndex === 0}
                        onClick={() =>
                          chooseSection(sections[sectionIndex - 1].id)
                        }
                      >
                        <ArrowLeft size={17} aria-hidden="true" />
                        {t.previous}
                      </button>
                      <button
                        type="button"
                        disabled={sectionIndex === sections.length - 1}
                        onClick={() =>
                          chooseSection(sections[sectionIndex + 1].id)
                        }
                      >
                        {t.next}
                        <ArrowRight size={17} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <section className="pdf-form-view" aria-label={t.form}>
                <div className="pdf-form-toolbar">
                  <p>{t.sampleHelp}</p>
                  <button
                    type="button"
                    className="pdf-primary"
                    disabled={!printable}
                    onClick={() => window.print()}
                  >
                    <Printer size={19} aria-hidden="true" />
                    {t.print}
                  </button>
                  <a
                    href="/tenken/original.pdf"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t.source}
                  </a>
                </div>
                {print.issues.length > 0 && (
                  <div className="pdf-alert" role="alert">
                    {t.printIssues} {print.issues.map(issueLabel).join(", ")}.
                  </div>
                )}
                <div className="pdf-paper">
                  <OriginalForm
                    state={state}
                    measurementSession={measurementSession}
                  />
                </div>
              </section>
            )}
            <section className="pdf-notes">
              <label>
                {t.notes}
                <textarea
                  value={language === "ja" ? state.notesJa : state.notesPt}
                  maxLength={MAX_NOTES_LENGTH}
                  rows={3}
                  onChange={(event) =>
                    persist({
                      ...stateRef.current,
                      [language === "ja" ? "notesJa" : "notesPt"]:
                        event.target.value,
                      notesJaReviewed: false,
                    })
                  }
                />
              </label>
              {language === "pt-BR" && (
                <label>
                  {t.notesJa}
                  <textarea
                    lang="ja"
                    value={state.notesJa}
                    maxLength={MAX_NOTES_LENGTH}
                    rows={3}
                    onChange={(event) =>
                      persist({
                        ...stateRef.current,
                        notesJa: event.target.value,
                        notesJaReviewed: false,
                      })
                    }
                  />
                </label>
              )}
              {(language === "pt-BR" || state.notesPt.trim()) && (
                <div className="pdf-notes-review">
                  <p>{t.notesHelp}</p>
                  <label>
                    <input
                      type="checkbox"
                      checked={state.notesJaReviewed}
                      disabled={!state.notesJa.trim()}
                      onChange={(event) =>
                        persist({
                          ...stateRef.current,
                          notesJaReviewed: event.target.checked,
                        })
                      }
                    />
                    {t.reviewed}
                  </label>
                </div>
              )}
            </section>
          </main>
        )}
      </div>
      <div className="pdf-print-surface" lang="ja">
        {printable ? (
          <OriginalForm state={state} measurementSession={measurementSession} />
        ) : (
          <p>
            見本・未確定 —
            印刷前に帳票の入力内容と原本画像の読み込みを確認してください。
          </p>
        )}
      </div>
    </div>
  );
}
