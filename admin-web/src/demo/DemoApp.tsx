import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCheck,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  History,
  Home,
  Search,
  ShieldAlert,
  Truck,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import {
  emptyState,
  finalizeInspection,
  issues,
  itemHint,
  itemLabel,
  itemSection,
  items,
  loadState,
  newInspection,
  saveState,
  sectionsOf,
  simulateSync,
  statusLabel,
  STORAGE_KEY,
  updateAnswer,
  vehicleDescription,
  vehicles,
} from "./model";
import type {
  Answer,
  DemoState,
  Inspection,
  Photo,
  Status,
  Vehicle,
} from "./model";
import DrawingPad from "./DrawingPad";
import { samplePhoto } from "./samplePhoto";
import VehicleCapture from "../vehicle-intake/VehicleCapture";
import BrandLogo from "../branding/BrandLogo";
import LanguageSwitch from "../branding/LanguageSwitch";
import { loadLanguage, saveLanguage } from "./language";
import type { Language } from "./language";
import { demoMessages, localeOf } from "./messages";
import PdfPreview from "./pdf-preview/PdfPreview";
import MeasurementStudio from "../measurements/MeasurementStudio";

type Page =
  | "home"
  | "setup"
  | "checklist"
  | "review"
  | "history"
  | "queue"
  | "report"
  | "capture"
  | "pdf-preview"
  | "measurements";
const statuses: Status[] = [
  "OK",
  "Attention",
  "Repair",
  "Critical",
  "NotApplicable",
];
const time = (iso: string, language: Language) =>
  new Date(iso).toLocaleString(localeOf[language], {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
const km = (n: number, language: Language) =>
  n.toLocaleString(localeOf[language]);

function TruckDrawing({ label }: { label: string }) {
  return (
    <svg
      className="truck-drawing"
      viewBox="0 0 440 190"
      role="img"
      aria-label={label}
    >
      <path d="M15 154H420" stroke="#9fadbe" strokeWidth="2" />
      <rect
        x="48"
        y="27"
        width="226"
        height="107"
        rx="5"
        fill="#d2dbe6"
        stroke="#66768c"
        strokeWidth="3"
      />
      <path
        d="M67 45H255M67 66H255M67 87H255M67 108H255"
        stroke="#bcc8d6"
        strokeWidth="2"
      />
      <path d="M280 65H334L375 108V138H280Z" fill="#344257" />
      <path d="M293 77H329L352 104H293Z" fill="#e9eef4" />
      <path d="M282 118H368" stroke="#a3cdb0" strokeWidth="3" />
      <rect x="40" y="133" width="341" height="13" rx="3" fill="#253246" />
      <circle cx="109" cy="144" r="23" fill="#253246" />
      <circle cx="109" cy="144" r="10" fill="#bcc8d6" />
      <circle cx="232" cy="144" r="23" fill="#253246" />
      <circle cx="232" cy="144" r="10" fill="#bcc8d6" />
      <circle cx="332" cy="144" r="23" fill="#253246" />
      <circle cx="332" cy="144" r="10" fill="#bcc8d6" />
      <text x="91" y="77" fontSize="21" fontWeight="700" fill="#44536a">
        ススム
      </text>
    </svg>
  );
}

export default function DemoApp() {
  const [initial] = useState(() => {
    try {
      const loaded = loadState(localStorage);
      if (
        loaded.inspections.some(
          (i) => !vehicles.some((v) => v.id === i.vehicleId),
        )
      )
        throw new Error("Veículo desconhecido");
      return {
        data: loaded,
        raw: localStorage.getItem(STORAGE_KEY),
        failed: false,
      };
    } catch {
      return { data: emptyState(), raw: null, failed: true };
    }
  });
  // The workshop is in Japan, so the application opens in Japanese; the choice a
  // mechanic makes here is remembered and carried into every other screen.
  const [language, setLanguage] = useState<Language>(() =>
    loadLanguage(localStorage),
  );
  const t = demoMessages[language];
  function changeLanguage(next: Language) {
    setLanguage(next);
    saveLanguage(localStorage, next);
  }
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const [data, setData] = useState<DemoState>(initial.data);
  const dataRef = useRef(data);
  const storedRef = useRef(initial.raw);
  const [page, setPage] = useState<Page>(() =>
    window.location.hash === "#medicoes"
      ? "measurements"
      : window.location.hash === "#tenken-pdf"
        ? "pdf-preview"
        : "home",
  );
  const [measurementsOpened, setMeasurementsOpened] = useState(
    () => window.location.hash === "#medicoes",
  );
  function openMeasurements() {
    setMeasurementsOpened(true);
    setPage("measurements");
    window.history.replaceState(null, "", "#medicoes");
  }
  const [pdfOpened, setPdfOpened] = useState(
    () => window.location.hash === "#tenken-pdf",
  );
  function openPdfPreview() {
    setPdfOpened(true);
    setPage("pdf-preview");
    window.history.replaceState(null, "", "#tenken-pdf");
  }
  const [activeId, setActiveId] = useState("");
  const [vehicleId, setVehicleId] = useState(vehicles[0].id);
  const [odometer, setOdometer] = useState(String(vehicles[0].odometer));
  const [operator, setOperator] = useState(
    () => demoMessages[loadLanguage(localStorage)].operatorName,
  );
  const [query, setQuery] = useState("");
  const [itemIndex, setItemIndex] = useState(0);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState("");
  const [unsaved, setUnsaved] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState("");
  const [drawingSignature, setDrawingSignature] = useState(false);
  const [annotation, setAnnotation] = useState<Photo | null>(null);
  const annotationTarget = useRef<{
    inspectionId: string;
    itemId: string;
  } | null>(null);
  const [preview, setPreview] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);
  const active = data.inspections.find((i) => i.id === activeId);
  const vehicle = vehicles.find(
    (v) => v.id === (active?.vehicleId ?? vehicleId),
  )!;
  const item = items[itemIndex];
  const answer = active?.answers[item.id];
  const drafts = data.inspections.filter((i) => i.state === "Draft");
  const finalized = data.inspections.filter((i) => i.state === "Finalized");
  const pending = finalized.filter((i) => !i.sent);
  const problems = active
    ? items.filter((i) =>
        ["Attention", "Repair", "Critical"].includes(
          active.answers[i.id]?.status ?? "",
        ),
      )
    : [];
  const answered = active
    ? items.filter((i) => active.answers[i.id]?.status).length
    : 0;

  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  function persist(next: DemoState, retainOnFailure = true) {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== storedRef.current) {
        if (retainOnFailure) {
          dataRef.current = next;
          setData(next);
        }
        setConflict(true);
        setUnsaved(true);
        setError(t.conflictError);
        return false;
      }
      saveState(localStorage, next);
      storedRef.current = JSON.stringify(next);
      dataRef.current = next;
      setData(next);
      setUnsaved(false);
      setError("");
      return true;
    } catch {
      if (retainOnFailure) {
        dataRef.current = next;
        setData(next);
      }
      setUnsaved(true);
      setError(t.unsavedError);
      return false;
    }
  }
  function replace(next: Inspection, retainOnFailure = true) {
    return persist(
      {
        ...dataRef.current,
        inspections: dataRef.current.inspections.map((i) =>
          i.id === next.id ? next : i,
        ),
      },
      retainOnFailure,
    );
  }
  function patch(
    change: Partial<Answer>,
    targetId = activeId,
    targetItem = item.id,
    retainOnFailure = true,
  ) {
    try {
      const latest = dataRef.current.inspections.find((i) => i.id === targetId);
      if (!latest) throw new Error(t.draftNotFound);
      const next = updateAnswer(latest, targetItem, change);
      if (
        change.photos &&
        JSON.stringify({
          ...dataRef.current,
          inspections: dataRef.current.inspections.map((i) =>
            i.id === next.id ? next : i,
          ),
        }).length > 1_500_000
      ) {
        setError(t.photoLimit);
        return false;
      }
      return replace(next, retainOnFailure);
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  function open(i: Inspection) {
    setActiveId(i.id);
    setItemIndex(0);
    setPage(i.state === "Draft" ? "checklist" : "report");
    setNotice("");
  }
  function setup(v: Vehicle) {
    setVehicleId(v.id);
    setActiveId("");
    setOdometer(String(v.odometer));
    setPage("setup");
    setNotice("");
  }
  function start() {
    try {
      if (!odometer.trim()) throw new Error(t.odometerRequired);
      const i = newInspection(vehicleId, Number(odometer), operator);
      persist({
        ...dataRef.current,
        inspections: [i, ...dataRef.current.inspections],
      });
      setActiveId(i.id);
      setItemIndex(0);
      setPage("checklist");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function addPhoto(file: File | undefined) {
    if (!file || !active) return;
    if (
      !["image/jpeg", "image/png"].includes(file.type) ||
      file.size > 1024 * 1024
    ) {
      setError(t.photoTypeSize);
      return;
    }
    const target = active.id;
    const targetItem = item.id;
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error(t.photoReadFail));
        r.readAsDataURL(file);
      });
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(t.photoInvalid));
        img.src = dataUrl;
      });
      const current = dataRef.current.inspections.find((i) => i.id === target)!;
      patch(
        {
          photos: [
            ...current.answers[targetItem].photos,
            {
              id: crypto.randomUUID(),
              name: file.name,
              dataUrl,
              kind: "Original",
            },
          ],
        },
        target,
        targetItem,
        false,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function synchronize() {
    if (!online) {
      setNotice(t.offlineSyncNotice);
      return;
    }
    if (persist(simulateSync(dataRef.current)))
      setNotice(t.syncDone);
  }
  function exportData() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(dataRef.current, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "susumu-tenken-demonstracao.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (initial.failed)
    return (
      <main className="fatal" lang={language}>
        <ShieldAlert size={40} />
        <h1>{t.dataPreserved}</h1>
        <p role="alert">{t.readFailure}</p>
      </main>
    );
  return (
    <>
      {measurementsOpened && (
        <MeasurementStudio
          active={page === "measurements"}
          language={language}
          onLanguageChange={changeLanguage}
          onBack={() => {
            setPage("home");
            window.history.replaceState(
              null,
              "",
              window.location.pathname + window.location.search,
            );
          }}
        />
      )}
      {pdfOpened && (
        <PdfPreview
          active={page === "pdf-preview"}
          language={language}
          onLanguageChange={changeLanguage}
          onBack={() => {
            setPage("home");
            window.history.replaceState(
              null,
              "",
              window.location.pathname + window.location.search,
            );
          }}
        />
      )}
      <VehicleCapture
        active={page === "capture"}
        language={language}
        onLanguageChange={changeLanguage}
        onBack={() => setPage("home")}
      />
      <div
        className="demo-shell"
        lang={language}
        style={
          page === "capture" ||
          page === "pdf-preview" ||
          page === "measurements"
            ? { display: "none" }
            : undefined
        }
      >
        <aside
          className="sidebar rail"
          inert={Boolean(drawingSignature || annotation || preview)}
        >
          <a className="brand" href="/demo.html">
            <BrandLogo />
          </a>
          <div className="workshop">
            {t.workshopName}
            <span>{t.workshopSub}</span>
          </div>
          <nav aria-label={t.navMain}>
            {/* Trilho de ícones: o rótulo visível é curto, mas o nome acessível
                continua sendo o nome completo do destino. */}
            <button aria-label={t.navMeasurements} onClick={openMeasurements}>
              <ClipboardCheck size={22} />
              <span>{t.railMeasure}</span>
            </button>
            <button aria-label={t.navPdf} onClick={openPdfPreview}>
              <FileCheck2 size={22} />
              <span>{t.railPdf}</span>
            </button>
            <button
              aria-label={t.navCapture}
              onClick={() => setPage("capture")}
            >
              <Truck size={22} />
              <span>{t.railCapture}</span>
            </button>
            <button
              aria-label={t.navHome}
              className={
                ["home", "setup", "checklist", "review"].includes(page)
                  ? "selected"
                  : ""
              }
              onClick={() => setPage("home")}
            >
              <Home size={22} />
              <span>{t.railHome}</span>
            </button>
            <button
              aria-label={t.navQueue}
              className={page === "queue" ? "selected" : ""}
              onClick={() => setPage("queue")}
            >
              <Clock3 size={22} />
              <span>{t.railQueue}</span>
              <span className="nav-count">{pending.length}</span>
            </button>
            <button
              aria-label={t.navHistory}
              className={["history", "report"].includes(page) ? "selected" : ""}
              onClick={() => setPage("history")}
            >
              <History size={22} />
              <span>{t.railHistory}</span>
            </button>
          </nav>
          <div className="sidebar-bottom">
            <div className="avatar">{t.avatar}</div>
            <div>
              {t.operatorName}
              <small>{t.sessionLabel}</small>
            </div>
          </div>
        </aside>
        <div
          className="workspace"
          inert={Boolean(drawingSignature || annotation || preview)}
        >
          <header className="topbar">
            <span>
              {t.breadcrumbShop} <span className="slash">/</span>{" "}
              {t.breadcrumbTenken}
            </span>
            <div>
              <LanguageSwitch language={language} onChange={changeLanguage} />
              <span className="demo-tag">{t.demoTag}</span>
              <button
                className={`connection ${online ? "" : "offline"}`}
                onClick={() => {
                  setOnline(!online);
                  setNotice(!online ? t.noticeOnline : t.noticeOffline);
                }}
              >
                {online ? <Wifi size={17} /> : <WifiOff size={17} />}{" "}
                {online ? t.online : t.offline}
              </button>
            </div>
          </header>
          <main>
            {error && (
              <div className="alert danger" role="alert">
                {error}
                {unsaved && !conflict && (
                  <button onClick={() => persist(dataRef.current)}>
                    {t.retrySave}
                  </button>
                )}
                {unsaved && (
                  <button onClick={exportData}>{t.exportMemory}</button>
                )}
                {!unsaved && (
                  <button
                    aria-label={t.closeWarning}
                    onClick={() => setError("")}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            )}
            {notice && (
              <div className="alert info" role="status">
                {notice}
                <button
                  aria-label={t.closeInfo}
                  onClick={() => setNotice("")}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {page === "home" && (
              <>
                <div className="page-heading">
                  <div>
                    <h1>{t.homeTitle}</h1>
                    <p>{t.homeSubtitle}</p>
                  </div>
                  <span className="date-label">{t.pilotLabel}</span>
                </div>
                {/* Painel bento: os números do dia, a lista de veículos e o
                    rascunho aberto cabem na primeira tela, sem rolagem. */}
                <div className="bento">
                  <article className="card kpi accent">
                    <span className="kpi-l">{t.statInProgress}</span>
                    <b className="kpi-n">{drafts.length}</b>
                  </article>
                  <article className="card kpi">
                    <span className="kpi-l">{t.statFinalized}</span>
                    <b className="kpi-n">{finalized.length}</b>
                  </article>
                  <article className="card kpi">
                    <span className="kpi-l">{t.statQueue}</span>
                    <b className="kpi-n">{pending.length}</b>
                  </article>
                  <article className="card kpi">
                    <span className="kpi-l">{t.statVehicles}</span>
                    <b className="kpi-n">{vehicles.length}</b>
                  </article>

                  <section className="card bento-vehicles">
                    <div className="section-heading">
                      <div>
                        <h2>{t.vehiclesTitle}</h2>
                        <p>{t.vehiclesSubtitle}</p>
                      </div>
                      <label className="search">
                        <Search size={19} />
                        <input
                          aria-label={t.searchVehicle}
                          placeholder={t.searchPlaceholder}
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="vehicle-rows">
                      {vehicles
                        .filter((v) =>
                          `${v.number} ${v.plate} ${v.description} ${v.descriptionJa}`
                            .toLowerCase()
                            .includes(query.toLowerCase()),
                        )
                        .map((v) => (
                          <article className="vehicle-row" key={v.id}>
                            <span className="vehicle-icon">
                              <Truck size={24} />
                            </span>
                            <span className="vehicle-id">
                              <b>{v.number}</b>
                              <span className="plate">{v.plate}</span>
                            </span>
                            <span className="vehicle-desc">
                              {vehicleDescription(v, language)}
                              <small>
                                {t.lastReading} {km(v.odometer, language)} km
                              </small>
                            </span>
                            <button
                              className="primary"
                              aria-label={`${t.inspectPrefix} ${v.number}`}
                              onClick={() => setup(v)}
                            >
                              {t.startInspection}
                              <ArrowRight size={18} />
                            </button>
                          </article>
                        ))}
                      {vehicles.filter((v) =>
                        `${v.number} ${v.plate} ${v.description} ${v.descriptionJa}`
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                      ).length === 0 && (
                        <div className="empty">{t.noVehicles}</div>
                      )}
                    </div>
                  </section>

                  <section className="card bento-draft">
                    <h2>
                      <Clock3 size={19} /> {t.resumeTitle}
                    </h2>
                    {drafts.length === 0 && (
                      <p className="bento-empty">{t.draftsEmpty}</p>
                    )}
                    {drafts.map((i) => (
                      <button
                        className="draft-open"
                        key={i.id}
                        onClick={() => open(i)}
                        aria-label={`${t.resumePrefix} ${vehicles.find((v) => v.id === i.vehicleId)!.number}`}
                      >
                        <b>
                          {vehicles.find((v) => v.id === i.vehicleId)!.number}
                        </b>
                        <span>
                          {
                            items.filter((it) => i.answers[it.id]?.status)
                              .length
                          }
                          /{items.length} {t.itemsWord} ·{" "}
                          {time(i.startedAt, language)}
                        </span>
                        <ArrowRight size={18} />
                      </button>
                    ))}
                  </section>

                  <section className="card launcher">
                    <div>
                      <h2>{t.measureCardTitle}</h2>
                      <p>{t.measureCardText}</p>
                    </div>
                    <button className="primary" onClick={openMeasurements}>
                      <ClipboardCheck size={20} />
                      {t.measureCardButton}
                    </button>
                  </section>

                  <section className="card launcher">
                    <div>
                      <h2>{t.pdfCardTitle}</h2>
                      <p>{t.pdfCardText}</p>
                    </div>
                    <button className="primary" onClick={openPdfPreview}>
                      <FileCheck2 size={20} />
                      {t.pdfCardButton}
                    </button>
                  </section>

                  <section className="card welcome-panel">
                    <div>
                      <span className="small-label">{t.benchLabel}</span>
                      <h2>
                        {t.benchTitleLine1}
                        <br />
                        {t.benchTitleLine2}
                      </h2>
                      <p>{t.benchText}</p>
                    </div>
                    <TruckDrawing label={t.truckAlt} />
                  </section>
                </div>
                <p className="footnote">
                  <ShieldAlert size={16} /> {t.footnote}
                </p>
              </>
            )}
            {page === "setup" && (
              <>
                <button className="back" onClick={() => setPage("home")}>
                  <ArrowLeft size={17} />
                  {t.backToVehicles}
                </button>
                <div className="page-heading">
                  <div>
                    <h1>{t.setupTitle}</h1>
                    <p>{t.setupSubtitle}</p>
                  </div>
                </div>
                <div className="setup-grid">
                  <section className="panel identity">
                    <TruckDrawing label={t.truckAlt} />
                    <h2>
                      {t.vehicleWord} {vehicle.number}
                    </h2>
                    <p>{vehicleDescription(vehicle, language)}</p>
                    <div className="plate">{vehicle.plate}</div>
                    <p>
                      {t.lastReading}: <b>{km(vehicle.odometer, language)} km</b>
                    </p>
                    <span className="pill neutral">{t.syntheticPill}</span>
                  </section>
                  <section className="panel form-panel">
                    <h2>{t.newInspection}</h2>
                    <label>
                      {t.operatorField}
                      <input
                        value={operator}
                        maxLength={80}
                        onChange={(e) => setOperator(e.target.value)}
                      />
                    </label>
                    <label>
                      {t.odometerField}
                      <input
                        inputMode="numeric"
                        type="number"
                        min={vehicle.odometer}
                        step="1"
                        value={odometer}
                        onChange={(e) => setOdometer(e.target.value)}
                      />
                    </label>
                    <p className="field-help">{t.odometerHelp}</p>
                    <div className="template-info">
                      <ClipboardCheck size={24} />
                      <div>
                        <b>{t.templateTitle}</b>
                        <p>{t.templateInfo}</p>
                      </div>
                    </div>
                    <button
                      className="primary full"
                      disabled={unsaved}
                      onClick={start}
                    >
                      {t.startTenken}
                    </button>
                  </section>
                </div>
              </>
            )}
            {page === "checklist" && active && answer && (
              <>
                <div className="inspection-heading">
                  <div>
                    <button className="back" onClick={() => setPage("home")}>
                      <ArrowLeft size={16} />
                      {t.backToShop}
                    </button>
                    <h1>
                      {t.breadcrumbTenken} <span>{vehicle.number}</span>
                    </h1>
                    <p>
                      {vehicle.plate} · {km(active.odometer, language)} km ·{" "}
                      {active.operator}
                    </p>
                  </div>
                  <div className="save-indicator">
                    {unsaved ? (
                      <ShieldAlert size={18} />
                    ) : (
                      <CheckCheck size={18} />
                    )}{" "}
                    {unsaved ? t.unsavedLabel : t.savedLabel}
                    <small>{t.draftVersion}</small>
                  </div>
                </div>
                <div className="inspection-layout">
                  <aside className="checklist-nav">
                    <div className="progress-label">
                      <b>
                        {answered} {t.ofWord} {items.length} {t.answeredWord}
                      </b>
                      <span>
                        {Math.round((answered / items.length) * 100)}%
                      </span>
                    </div>
                    <progress max={items.length} value={answered} />
                    {sectionsOf(language).map((section) => (
                      <div className="check-section" key={section}>
                        <h2>{section}</h2>
                        {items.map(
                          (it, index) =>
                            itemSection(it, language) === section && (
                              <button
                                key={it.id}
                                className={index === itemIndex ? "active" : ""}
                                onClick={() => setItemIndex(index)}
                              >
                                <span
                                  className={`item-dot ${active.answers[it.id]?.status ?? ""}`}
                                >
                                  {active.answers[it.id]?.status ? (
                                    <Check size={12} />
                                  ) : (
                                    index + 1
                                  )}
                                </span>
                                {itemLabel(it, language)}
                              </button>
                            ),
                        )}
                      </div>
                    ))}
                  </aside>
                  <section className="panel item-panel">
                    <div className="section-heading">
                      <span className="small-label">
                        {itemSection(item, language)}
                      </span>
                      <span className="pill neutral">
                        {t.itemWord} {itemIndex + 1} / {items.length}
                      </span>
                    </div>
                    <h2>{itemLabel(item, language)}</h2>
                    <p className="item-hint">{itemHint(item, language)}</p>
                    <fieldset className="status-field">
                      <legend>{t.conditionLegend}</legend>
                      <div className="status-options">
                        {statuses
                          .filter((s) => s !== "NotApplicable" || item.allowNA)
                          .map((s) => (
                            <button
                              key={s}
                              className={`status-option ${s} ${answer.status === s ? "chosen" : ""}`}
                              aria-pressed={answer.status === s}
                              aria-label={statusLabel(s, language)}
                              onClick={() => patch({ status: s })}
                            >
                              <span>
                                {s === "OK"
                                  ? "✓"
                                  : s === "Attention"
                                    ? "!"
                                    : s === "Repair"
                                      ? "↗"
                                      : s === "Critical"
                                        ? "!!"
                                        : "—"}
                              </span>
                              {statusLabel(s, language)}
                            </button>
                          ))}
                      </div>
                    </fieldset>
                    {answer.status === "Critical" && (
                      <div className="alert danger">
                        <ShieldAlert size={22} />
                        <div>
                          <b>{t.criticalTitle}</b>
                          <p>{t.criticalText}</p>
                        </div>
                      </div>
                    )}
                    {item.unit && answer.status !== "NotApplicable" && (
                      <label className="measurement">
                        {t.measurementLabel} ({item.unit})
                        <input
                          type="text"
                          inputMode="decimal"
                          value={answer.value}
                          onChange={(e) => patch({ value: e.target.value })}
                        />
                        <span className="field-help">
                          {t.rangePrefix} {item.min} {t.toWord} {item.max}{" "}
                          {item.unit}. {t.rangeSuffix}
                        </span>
                      </label>
                    )}
                    <label className="notes-label">
                      {t.notesLabel}
                      <textarea
                        rows={3}
                        value={answer.notes}
                        placeholder={t.notesPlaceholder}
                        onChange={(e) => patch({ notes: e.target.value })}
                      />
                    </label>
                    <div className="photo-section">
                      <div>
                        <h3>{t.evidence}</h3>
                        <p>{t.evidenceText}</p>
                      </div>
                      <label
                        className={`upload-button ${busy ? "disabled" : ""}`}
                      >
                        <Camera size={18} />
                        {busy ? t.readingPhoto : t.addPhoto}
                        <input
                          type="file"
                          accept="image/png,image/jpeg"
                          disabled={busy}
                          aria-label={t.addPhoto}
                          onChange={(e) => {
                            void addPhoto(e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => {
                        patch(
                          {
                            photos: [
                              ...answer.photos,
                              {
                                id: crypto.randomUUID(),
                                name: t.testPhotoName,
                                dataUrl: samplePhoto,
                                kind: "Original",
                              },
                            ],
                          },
                          active.id,
                          item.id,
                          false,
                        );
                      }}
                    >
                      {t.useTestImage}
                    </button>
                    {answer.photos.length > 0 && (
                      <div className="photo-grid">
                        {answer.photos.map((p) => (
                          <div key={p.id}>
                            <button
                              className="photo-preview"
                              onClick={() => setPreview(p)}
                            >
                              <img src={p.dataUrl} alt={p.name} />
                            </button>
                            <small>
                              {p.kind === "Original"
                                ? t.originalKept
                                : t.annotatedCopy}
                            </small>
                            {p.kind === "Original" && (
                              <button
                                className="text-button"
                                onClick={() => {
                                  annotationTarget.current = {
                                    inspectionId: active.id,
                                    itemId: item.id,
                                  };
                                  setAnnotation(p);
                                }}
                              >
                                {t.annotate}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="item-footer">
                      <button
                        disabled={itemIndex === 0 || busy}
                        onClick={() => setItemIndex(itemIndex - 1)}
                      >
                        <ArrowLeft size={17} />
                        {t.previous}
                      </button>
                      {itemIndex < items.length - 1 ? (
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() => setItemIndex(itemIndex + 1)}
                        >
                          {t.nextItem}
                          <ArrowRight size={17} />
                        </button>
                      ) : (
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() => setPage("review")}
                        >
                          {t.reviewInspection}
                        </button>
                      )}
                    </div>
                  </section>
                </div>
                {itemIndex < items.length - 1 && (
                  <div className="review-bar">
                    <span>{t.allItemsNeedAnswer}</span>
                    <button disabled={busy} onClick={() => setPage("review")}>
                      <ClipboardCheck size={18} />
                      {t.reviewInspection}
                    </button>
                  </div>
                )}
              </>
            )}
            {page === "review" && active && (
              <>
                <button className="back" onClick={() => setPage("checklist")}>
                  <ArrowLeft size={17} />
                  {t.backToChecklist}
                </button>
                <div className="page-heading">
                  <div>
                    <h1>{t.reviewInspection}</h1>
                    <p>
                      {t.vehicleWord} {vehicle.number} · {answered}/
                      {items.length} {t.itemsAnswered}
                    </p>
                  </div>
                  <span className="pill warning">
                    {problems.length} {t.occurrences}
                  </span>
                </div>
                <div className="review-grid">
                  <section className="panel">
                    <h2>{t.summaryTitle}</h2>
                    <ResultList
                      inspection={active}
                      language={language}
                      onItem={(index) => {
                        setItemIndex(index);
                        setPage("checklist");
                      }}
                    />
                    <h3>{t.signatureTitle}</h3>
                    <p className="field-help">{t.signatureHelp}</p>
                    {active.signature ? (
                      <div className="signature-saved">
                        <img
                          src={active.signature}
                          alt={t.signatureSavedAlt}
                        />
                        <button onClick={() => setDrawingSignature(true)}>
                          {t.redoSignature}
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setDrawingSignature(true)}>
                        {t.drawSignature}
                      </button>
                    )}
                  </section>
                  <aside className="panel finish-panel">
                    <FileCheck2 size={32} />
                    <h2>{t.finishTitle}</h2>
                    <p>{t.finishText}</p>
                    {problems.some(
                      (it) => active.answers[it.id].status === "Critical",
                    ) && (
                      <div className="alert danger">{t.criticalReview}</div>
                    )}
                    <div className="validation-list" aria-live="polite">
                      {issues(active, language).length ? (
                        <>
                          <h3>{t.pendingTitle}</h3>
                          <ul>
                            {issues(active, language).map((problem, index) => (
                              <li key={index}>{problem}</li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <p className="valid">
                          <CheckCheck size={18} />
                          {t.readyToFinish}
                        </p>
                      )}
                    </div>
                    <button
                      className="primary full"
                      disabled={
                        issues(active, language).length > 0 || unsaved || busy
                      }
                      onClick={() => {
                        try {
                          const done = finalizeInspection(active);
                          if (replace(done, false)) {
                            setPage("report");
                            setNotice(t.finalizedNotice);
                          }
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      {t.finishButton}
                    </button>
                    <p className="field-help">{t.sendSeparate}</p>
                  </aside>
                </div>
              </>
            )}
            {(page === "history" || page === "queue") && (
              <>
                <div className="page-heading">
                  <div>
                    <h1>
                      {page === "history" ? t.historyTitle : t.queueTitle}
                    </h1>
                    <p>
                      {page === "history"
                        ? t.historySubtitle
                        : t.queueSubtitle}
                    </p>
                  </div>
                  {page === "queue" && (
                    <button
                      className="primary"
                      disabled={!online || pending.length === 0 || unsaved}
                      onClick={synchronize}
                    >
                      <Wifi size={18} />
                      {t.simulateSend}
                    </button>
                  )}
                </div>
                <div className="alert info">
                  {page === "queue" ? t.queueInfo : t.historyInfo}
                </div>
                {(page === "queue" ? pending : finalized).length === 0 ? (
                  <div className="empty">
                    <FileCheck2 size={40} />
                    <h2>
                      {page === "queue" ? t.noQueue : t.noFinalized}
                    </h2>
                    <p>{t.emptyHint}</p>
                    <button onClick={() => setPage("home")}>
                      {t.goToShop}
                    </button>
                  </div>
                ) : (
                  <div className="history-list">
                    {(page === "queue" ? pending : finalized).map((i) => (
                      <button key={i.id} onClick={() => open(i)}>
                        <span className="vehicle-icon">
                          <Truck size={25} />
                        </span>
                        <span>
                          <b>
                            {t.vehicleWord}{" "}
                            {vehicles.find((v) => v.id === i.vehicleId)!.number}
                          </b>
                          <small>
                            {time(i.finalizedAt!, language)} · {i.operator}
                          </small>
                        </span>
                        <span
                          className={`pill ${i.sent ? "success" : "warning"}`}
                        >
                          {i.sent ? t.sentPill : t.pendingPill}
                        </span>
                        <ArrowRight size={19} />
                      </button>
                    ))}
                  </div>
                )}
                {page === "history" && (
                  <button onClick={exportData}>{t.exportDemo}</button>
                )}
              </>
            )}
            {page === "report" && active && (
              <>
                <div className="page-heading">
                  <div>
                    <span className="pill success">
                      <CheckCheck size={16} />
                      {t.finalizedPill}
                    </span>
                    <h1>
                      {t.reportPrefix} {vehicle.number}
                    </h1>
                    <p>
                      {vehicle.plate} · {km(active.odometer, language)} km ·{" "}
                      {active.operator} ·{" "}
                      {time(active.finalizedAt!, language)}
                    </p>
                  </div>
                  <button onClick={() => window.print()}>
                    {t.printReport}
                  </button>
                </div>
                <div className="alert info">
                  {t.localDemo} ·{" "}
                  {active.sent ? t.sentSim : t.pendingSim} {t.notReleased}
                </div>
                <section className="panel report">
                  <h2>{t.templateTitle}</h2>
                  <ResultList inspection={active} language={language} />
                  {active.signature && (
                    <div className="signature-saved">
                      <h3>{t.signatureTitle}</h3>
                      <img src={active.signature} alt={t.signatureTitle} />
                    </div>
                  )}
                  <p>
                    {t.identifier}: {active.id}
                  </p>
                </section>
                <div className="actions">
                  <button className="primary" onClick={() => setPage("home")}>
                    {t.backToShop}
                  </button>
                  {!active.sent && (
                    <button onClick={() => setPage("queue")}>
                      {t.seeQueue}
                    </button>
                  )}
                  <button onClick={exportData}>{t.exportJson}</button>
                </div>
              </>
            )}
          </main>
          <footer>
            {t.footerBrand}
            <span>{t.footerText}</span>
          </footer>
        </div>
        {(drawingSignature || annotation || preview) && (
          <div className="modal-backdrop">
            <section
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-label={
                drawingSignature
                  ? t.signatureTitle
                  : annotation
                    ? t.annotatePhoto
                    : t.viewPhoto
              }
            >
              <div className="section-heading">
                <h2>
                  {drawingSignature
                    ? t.signatureTitle
                    : annotation
                      ? t.annotatePhoto
                      : preview?.kind === "Original"
                        ? t.originalPhoto
                        : t.annotatedCopy}
                </h2>
                <button
                  aria-label={t.closeWindow}
                  onClick={() => {
                    setDrawingSignature(false);
                    setAnnotation(null);
                    setPreview(null);
                  }}
                >
                  <X size={20} />
                </button>
              </div>
              {drawingSignature && (
                <DrawingPad
                  onCancel={() => setDrawingSignature(false)}
                  onSave={(signature) => {
                    if (active) {
                      const saved = replace({ ...active, signature }, false);
                      if (saved) setDrawingSignature(false);
                      return saved;
                    }
                    return false;
                  }}
                />
              )}
              {annotation && (
                <DrawingPad
                  background={annotation.dataUrl}
                  onCancel={() => setAnnotation(null)}
                  onSave={(dataUrl) => {
                    const target = annotationTarget.current;
                    const owner = dataRef.current.inspections.find(
                      (i) => i.id === target?.inspectionId,
                    );
                    if (target && owner) {
                      const saved = patch(
                        {
                          photos: [
                            ...owner.answers[target.itemId].photos,
                            {
                              id: crypto.randomUUID(),
                              name: `${t.annotationPrefix} ${annotation.name}`,
                              dataUrl,
                              kind: "Annotation",
                              originalId: annotation.id,
                            },
                          ],
                        },
                        target.inspectionId,
                        target.itemId,
                        false,
                      );
                      if (saved) setAnnotation(null);
                      return saved;
                    }
                    return false;
                  }}
                />
              )}{" "}
              {preview && (
                <img
                  className="full-photo"
                  src={preview.dataUrl}
                  alt={preview.name}
                />
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}

function ResultList({
  inspection,
  language,
  onItem,
}: {
  inspection: Inspection;
  language: Language;
  onItem?: (index: number) => void;
}) {
  const t = demoMessages[language];
  return (
    <div className="result-list">
      {items.map((it, index) => {
        const a = inspection.answers[it.id];
        return (
          <div className="result-row" key={it.id}>
            <div className="result-main">
              {onItem ? (
                <button className="text-button" onClick={() => onItem(index)}>
                  {itemLabel(it, language)}
                </button>
              ) : (
                <b>{itemLabel(it, language)}</b>
              )}
              <span className={`pill ${a?.status ?? "neutral"}`}>
                {a?.status ? statusLabel(a.status, language) : t.noAnswer}
              </span>
            </div>
            {it.unit && a?.status !== "NotApplicable" && (
              <p>
                {t.measurementLabel}: {a?.value || t.notInformed} {it.unit}
              </p>
            )}
            {a?.notes && <p className="preserve-lines">{a.notes}</p>}
            {a?.photos.length > 0 && (
              <div className="report-photos">
                {a.photos.map((p) => (
                  <figure key={p.id}>
                    <img src={p.dataUrl} alt={p.name} />
                    <figcaption>
                      {p.kind === "Original"
                        ? t.originalWord
                        : t.annotatedCopy}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
