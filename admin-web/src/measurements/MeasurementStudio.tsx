import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  Bluetooth,
  Check,
  Download,
  Gauge,
  History,
  Pencil,
  Printer,
  Ruler,
  Save,
} from "lucide-react";
import BrandLogo from "../branding/BrandLogo";
import LanguageSwitch from "../branding/LanguageSwitch";
import { loadLanguage, saveLanguage } from "../demo/language";
import PdfPreview from "../demo/pdf-preview/PdfPreview";
import { vehicles } from "../demo/model";
import {
  activeReadings,
  createReading,
  createSession,
  defaultWheelLayout,
  isBrakeMetric,
  MeasurementError,
  normalizeVehicleKey,
  parseMm,
  positionsFor,
  slotKey,
} from "./model";
import type { StoreKind } from "./storage";
import { storeKindFor } from "./storage";
import type {
  MeasurementSession,
  MeasurementStore,
  Metric,
  Position,
  Reading,
  Source,
} from "./model";
import { appendCorrection, loadMeasurements, saveSession } from "./storage";
import { emptyDraft, loadDraft, saveDraft } from "./draft";
import type { Draft as MeasurementDraft } from "./draft";
import {
  connectGauge,
  getBluetoothAvailability,
  getConfiguredProfile,
} from "./bluetooth";
import type { GaugeConnection } from "./bluetooth";
import {
  formatMm,
  messages,
  metricLabel,
  positionLabel,
  sourceLabel,
} from "./messages";
import type { Language } from "./messages";
import MeasurementReport from "./MeasurementReport";
import { getMeasurementReportIssues } from "./print";
import "./measurements.css";

interface Incoming {
  value: string;
  source: Source;
  deviceName: string;
  slot: string;
  vehicleKey: string;
  capturedAt: string;
}
function code(error: unknown) {
  return error instanceof MeasurementError
    ? error.code
    : "STORAGE_WRITE_FAILED";
}
function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function copyDownload(value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "susumu-medicoes.json";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function MeasurementStudio({
  active,
  onBack,
  language: languageProp,
  onLanguageChange,
}: {
  active: boolean;
  onBack: () => void;
  /** Supplied by the shell so one choice governs every screen. */
  language?: Language;
  onLanguageChange?: (next: Language) => void;
}) {
  const [initial] = useState(() => {
    const empty: MeasurementStore = { version: 1, sessions: [] };
    let store = empty;
    let historyError = "";
    try {
      store = loadMeasurements(localStorage, "real");
    } catch (error) {
      historyError = code(error);
    }
    let demoStore: MeasurementStore;
    try {
      demoStore = loadMeasurements(localStorage, "demo");
    } catch {
      // A damaged rehearsal store never blocks real work; it is left untouched.
      demoStore = empty;
    }
    try {
      // No plate, operator or odometer is filled in for the mechanic. A sample
      // truck is available from the register, chosen deliberately, so a real
      // measurement can never be saved under a demonstration plate by default.
      const loaded = loadDraft(localStorage);
      const draft = loaded.draft;
      return {
        store,
        demoStore,
        historyError,
        draft: [...store.sessions, ...demoStore.sessions].some(
          (s) => s.id === draft.id,
        )
          ? { ...draft, id: crypto.randomUUID(), readings: [] }
          : draft,
        raw: loaded.raw,
        draftError: "",
      };
    } catch (error) {
      return {
        store,
        demoStore,
        historyError,
        draft: emptyDraft(),
        raw: null,
        draftError: code(error),
      };
    }
  });
  const [draft, setDraft] = useState(initial.draft);
  const draftRef = useRef(draft);
  const rawRef = useRef(initial.raw);
  const [store, setStore] = useState(initial.store);
  const [demoStore, setDemoStore] = useState(initial.demoStore);
  const [historyKind, setHistoryKind] = useState<StoreKind>("real");
  const [historyError, setHistoryError] = useState(initial.historyError);
  const [draftError, setDraftError] = useState(initial.draftError);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // Standalone (in a test or opened directly) it follows the stored choice; in
  // the shell the prop wins, so switching here switches the whole application.
  const [ownLanguage, setOwnLanguage] = useState<Language>(() =>
    loadLanguage(localStorage),
  );
  const language = languageProp ?? ownLanguage;
  // Estáveis: o PdfPreview aberto a partir do histórico fica montado e é
  // memoizado; com callbacks novos a cada render o memo não teria efeito.
  const setLanguage = useCallback(
    (next: Language) => {
      setOwnLanguage(next);
      saveLanguage(localStorage, next);
      onLanguageChange?.(next);
    },
    [onLanguageChange],
  );
  const backToHistory = useCallback(() => setView("history"), []);
  const t = messages[language];
  const [view, setView] = useState<"entry" | "history" | "report" | "pdf">(
    "entry",
  );
  const [metric, setMetric] = useState<Metric>("tireTread");
  const [position, setPosition] = useState<Position>(
    () =>
      positionsFor(
        "tireTread",
        initial.draft.axleCount,
        initial.draft.wheelLayout,
      )[0],
  );
  const [mode, setMode] = useState<Source>("manual");
  const [value, setValue] = useState("");
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const connection = useRef<GaugeConnection | null>(null);
  const connectAbort = useRef<AbortController | null>(null);
  const [historyQuery, setHistoryQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [pdfSession, setPdfSession] = useState<MeasurementSession | null>(null);
  const [correction, setCorrection] = useState<{
    sessionId: string;
    reading: Reading;
  } | null>(null);
  const [correctionValue, setCorrectionValue] = useState("");
  const [correctionReason, setCorrectionReason] = useState("remeasurement");
  const slot = slotKey(metric, position);
  const vehicleKey = normalizeVehicleKey(draft.registration);
  const currentSlot = useRef({ slot, vehicleKey, active, mode });
  useEffect(() => {
    currentSlot.current = { slot, vehicleKey, active, mode };
  }, [slot, vehicleKey, active, mode]);
  useEffect(() => {
    if (!active || view === "pdf") return;
    document.body.classList.add("measurement-studio-active");
    return () => document.body.classList.remove("measurement-studio-active");
  }, [active, view]);
  useEffect(() => {
    if (!draftError && draft.readings.length === 0) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (draftError) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draftError, draft.readings.length]);
  useEffect(() => {
    if (active && view === "entry") return;
    connectAbort.current?.abort();
    connection.current?.disconnect();
  }, [active, view]);
  useEffect(
    () => () => {
      connectAbort.current?.abort();
      connection.current?.disconnect();
    },
    [],
  );

  function persist(next: MeasurementDraft) {
    if (initial.draftError) return;
    draftRef.current = next;
    setDraft(next);
    try {
      rawRef.current = saveDraft(localStorage, rawRef.current, next);
      setDraftError("");
    } catch (e) {
      setDraftError(code(e));
    }
  }
  function updateField(
    key: "registration" | "operator" | "inspectionDate" | "odometerInput",
    text: string,
  ) {
    const next = { ...draftRef.current, [key]: text };
    // A plate typed by hand no longer stands for the register entry that was
    // picked, so the fleet link is dropped rather than left pointing elsewhere.
    if (key === "registration") delete next.vehicleId;
    persist(next);
    setNotice("");
  }
  function selectPosition(next: Position) {
    setPosition(next);
    setValue("");
    setIncoming(null);
    setError("");
    setNotice("");
  }
  function selectMetric(next: Metric, selectedPosition?: Position) {
    connection.current?.disconnect();
    connectAbort.current?.abort();
    setMetric(next);
    selectPosition(
      selectedPosition ??
        positionsFor(next, draft.axleCount, draft.wheelLayout)[0],
    );
  }
  function selectMode(next: Source) {
    connection.current?.disconnect();
    connectAbort.current?.abort();
    setMode(next);
    setValue("");
    setIncoming(null);
    setError("");
  }
  function simulate() {
    const demoValue =
      (metric === "tireTread" ? 8.4 : 11.6) -
      position.axle * 0.35 -
      (position.side === "right" ? 0.15 : 0) -
      (position.wheel === "outer" ? 0.2 : 0);
    const sample = {
      value: demoValue.toFixed(2),
      source: "simulator" as const,
      deviceName: "Susumu Simulator",
      slot,
      vehicleKey,
      capturedAt: new Date().toISOString(),
    };
    setIncoming(sample);
    setValue(sample.value);
    setNotice("received");
    setError("");
  }
  async function connect() {
    setConnecting(true);
    setError("");
    const controller = new AbortController();
    connectAbort.current = controller;
    try {
      const connected = await connectGauge(
        getConfiguredProfile(),
        {
          onReading(mm, name) {
            const current = currentSlot.current;
            if (!current.active || current.mode !== "bluetooth") return;
            if (
              !Number.isFinite(mm) ||
              mm < 0 ||
              mm > 100 ||
              Math.abs(mm * 100 - Math.round(mm * 100)) > 1e-8
            ) {
              setError("btError");
              setIncoming(null);
              setValue("");
              return;
            }
            const received = {
              value: mm.toFixed(2),
              source: "bluetooth" as const,
              deviceName: name,
              slot: current.slot,
              vehicleKey: current.vehicleKey,
              capturedAt: new Date().toISOString(),
            };
            setIncoming(received);
            setValue(received.value);
            setNotice("received");
          },
          onDisconnect() {
            setDeviceName("");
            connection.current = null;
          },
          onError() {
            setError("btError");
            setIncoming(null);
            setValue("");
          },
        },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) connected.disconnect();
      else {
        connection.current = connected;
        setDeviceName(connected.deviceName);
      }
    } catch {
      if (!controller.signal.aborted) setError("btError");
    } finally {
      setConnecting(false);
    }
  }
  function capture() {
    setError("");
    if (!draft.registration.trim()) {
      setError("invalidSession");
      return;
    }
    if (parseMm(value) === null) {
      setError("invalidValue");
      return;
    }
    if (
      mode !== "manual" &&
      (!incoming ||
        incoming.slot !== slot ||
        incoming.vehicleKey !== vehicleKey ||
        incoming.source !== mode)
    ) {
      setError("invalidValue");
      return;
    }
    // One inspection is either a rehearsal or real work, never both: the two are
    // kept in separate histories, so a draft cannot straddle them.
    const kept = draftRef.current.readings.filter(
      (r) => slotKey(r.metric, r.position) !== slot,
    );
    const simulated = mode === "simulator";
    if (kept.some((r) => (r.source === "simulator") !== simulated)) {
      setError("mixedSources");
      return;
    }
    try {
      const reading = createReading(
        metric,
        position,
        value,
        mode,
        incoming?.deviceName ?? "",
        incoming?.capturedAt,
      );
      persist({ ...draftRef.current, readings: [...kept, reading] });
      setNotice("captured");
      setValue("");
      setIncoming(null);
    } catch {
      setError("invalidValue");
    }
  }
  function save() {
    setError("");
    try {
      if (!/^\d{1,7}$/.test(draft.odometerInput))
        throw new MeasurementError("INVALID_SESSION");
      const session = {
        ...createSession({
          registration: draft.registration,
          operator: draft.operator,
          inspectionDate: draft.inspectionDate,
          odometerKm: Number(draft.odometerInput),
          axleCount: draft.axleCount,
          wheelLayout: draft.wheelLayout,
          readings: draft.readings,
          vehicleId: draft.vehicleId,
        }),
        id: draft.id,
      };
      const kind = storeKindFor(session);
      const next = saveSession(localStorage, session);
      if (kind === "demo") setDemoStore(next);
      else {
        setStore(next);
        setHistoryError("");
      }
      setHistoryKind(kind);
      setSelectedId(session.id);
      persist({ ...draftRef.current, id: crypto.randomUUID(), readings: [] });
      setNotice("saved");
      setView("history");
      setHistoryQuery(session.registration);
      setValue("");
      setIncoming(null);
    } catch (e) {
      const value = code(e);
      setError(
        value === "DUPLICATE_ID"
          ? "alreadySaved"
          : value === "MIXED_SOURCES"
            ? "mixedSources"
            : value === "STORAGE_CONFLICT"
              ? "conflict"
              : value.startsWith("STORAGE")
                ? "storageError"
                : "invalidSession",
      );
    }
  }
  /**
   * Starts a fresh inspection. Used when this draft was already saved from
   * another tab: its readings carry identifiers that now exist in the history,
   * so the draft cannot be saved again without duplicating those records.
   */
  function startNewDraft() {
    persist({ ...draftRef.current, id: crypto.randomUUID(), readings: [] });
    setError("");
    setValue("");
    setIncoming(null);
  }
  function refreshHistory() {
    try {
      setStore(loadMeasurements(localStorage, "real"));
      setHistoryError("");
      setError("");
    } catch (e) {
      setHistoryError(code(e));
    }
    try {
      setDemoStore(loadMeasurements(localStorage, "demo"));
    } catch {
      // Rehearsal history is not allowed to mask a problem with real history.
    }
  }
  function correct() {
    if (!correction) return;
    setError("");
    try {
      const nextReading = {
        ...createReading(
          correction.reading.metric,
          correction.reading.position,
          correctionValue,
          "manual",
        ),
        supersedesId: correction.reading.id,
        correctionReason,
      };
      // The correction is appended to the store the session already lives in, so
      // a rehearsal record can never be repaired into the real history.
      const next = appendCorrection(
        localStorage,
        correction.sessionId,
        nextReading,
        historyKind,
      );
      if (historyKind === "demo") setDemoStore(next);
      else setStore(next);
      setCorrection(null);
      setNotice("corrected");
    } catch (e) {
      setError(
        code(e) === "INVALID_READING"
          ? "invalidValue"
          : code(e) === "STORAGE_CONFLICT" || code(e) === "INVALID_CORRECTION"
            ? "conflict"
            : "storageError",
      );
    }
  }

  const wheelPositions = positionsFor(
    metric,
    draft.axleCount,
    draft.wheelLayout,
  );
  // A draft holding simulated readings compares against rehearsal history only;
  // a real draft never shows a trend built from invented values.
  const draftKind: StoreKind = draft.readings.some(
    (r) => r.source === "simulator",
  )
    ? "demo"
    : "real";
  const entryStore = draftKind === "demo" ? demoStore : store;
  const visibleStore = historyKind === "demo" ? demoStore : store;
  // O histórico pode chegar a 500 sessões com 250 leituras cada; sem memo,
  // cada tecla digitada na placa ou no valor refazia filtro, ordenação e busca.
  const ownHistory = useMemo(
    () =>
      entryStore.sessions
        .filter((s) => s.vehicleKey === vehicleKey)
        .sort(
          (a, b) =>
            b.inspectionDate.localeCompare(a.inspectionDate) ||
            b.createdAt.localeCompare(a.createdAt),
        ),
    [entryStore, vehicleKey],
  );
  const slotHistory = useMemo(
    () =>
      ownHistory.flatMap((session) => {
        const reading = activeReadings(session).find(
          (r) => slotKey(r.metric, r.position) === slot,
        );
        return reading ? [{ session, reading }] : [];
      }),
    [ownHistory, slot],
  );
  const selectedSession =
    visibleStore.sessions.find((s) => s.id === selectedId) ?? null;
  const filteredHistory = useMemo(() => {
    const needle = normalizeVehicleKey(historyQuery);
    return [...visibleStore.sessions]
      .filter((s) => s.vehicleKey.includes(needle))
      .sort(
        (a, b) =>
          b.inspectionDate.localeCompare(a.inspectionDate) ||
          b.createdAt.localeCompare(a.createdAt),
      );
  }, [visibleStore, historyQuery]);
  const activeSelected = selectedSession ? activeReadings(selectedSession) : [];
  const drawnHeight = 150 + draft.axleCount * 76;
  const bluetoothAvailability = getBluetoothAvailability();
  const reportIssues = selectedSession
    ? getMeasurementReportIssues(selectedSession)
    : [];
  const errorText = error ? (t[error as keyof typeof t] ?? t.storageError) : "";
  const currentDraftReading = draft.readings.find(
    (r) => slotKey(r.metric, r.position) === slot,
  );

  return (
    <div className="measurement-root" hidden={!active} lang={language}>
      {pdfSession && (
        <PdfPreview
          key={pdfSession.id}
          active={active && view === "pdf"}
          measurementSession={pdfSession}
          language={language}
          onLanguageChange={setLanguage}
          onBack={backToHistory}
        />
      )}
      <div className="measurement-screen" hidden={view === "pdf"}>
        <header className="measure-top">
          <div className="measure-brand">
            <BrandLogo className="susumu-group-logo--compact" />
            <div>
              Susumu Service<strong>{t.section}</strong>
            </div>
          </div>
          <div className="measure-top-actions">
            <button type="button" onClick={onBack}>
              <ArrowLeft size={17} />
              {t.back}
            </button>
            <LanguageSwitch language={language} onChange={setLanguage} />
          </div>
        </header>
        <main className="measure-main">
          <div className="measure-heading">
            <div>
              <h1>{t.title}</h1>
              <p>{t.subtitle}</p>
            </div>
            <span className="measure-local">{t.local}</span>
          </div>
          <nav className="measure-tabs" aria-label={t.section}>
            <button
              type="button"
              aria-current={view === "entry" ? "page" : undefined}
              onClick={() => setView("entry")}
            >
              <Ruler size={19} />
              {t.entry}
            </button>
            <button
              type="button"
              aria-current={
                view === "history" || view === "report" ? "page" : undefined
              }
              onClick={() => {
                refreshHistory();
                setView("history");
              }}
            >
              <History size={19} />
              {t.history}
              <span>{store.sessions.length}</span>
            </button>
          </nav>
          {historyError && (
            <div className="measure-alert" role="alert">
              {t.corrupt}
              <button type="button" onClick={refreshHistory}>
                {t.refresh}
              </button>
            </div>
          )}
          {draftError && (
            <div className="measure-alert" role="alert">
              <p>
                {initial.draftError
                  ? t.corrupt
                  : draftError === "STORAGE_CONFLICT"
                    ? t.draftConflict
                    : t.storageError}
              </p>
              <button type="button" onClick={() => copyDownload(draft)}>
                {t.download}
              </button>
              {!initial.draftError && draftError !== "STORAGE_CONFLICT" && (
                <button type="button" onClick={() => persist(draftRef.current)}>
                  {t.save}
                </button>
              )}
            </div>
          )}
          {error && (
            <div className="measure-alert" role="alert">
              <p>{errorText}</p>
              <button
                type="button"
                onClick={() => copyDownload({ draft, store })}
              >
                <Download size={16} />
                {t.download}
              </button>
              {error === "conflict" && (
                <button type="button" onClick={refreshHistory}>
                  {t.refresh}
                </button>
              )}
              {error === "alreadySaved" && (
                <button type="button" onClick={startNewDraft}>
                  {t.newDraft}
                </button>
              )}
            </div>
          )}
          {notice && (
            <p className="measure-notice" role="status">
              <Check size={17} />
              {t[notice as keyof typeof t]}
            </p>
          )}
          {view === "entry" && (
            <>
              <section className="measure-identity" aria-label={t.details}>
                <label>
                  {t.vehicle}
                  <input
                    value={draft.registration}
                    maxLength={80}
                    disabled={draft.readings.length > 0 || !!initial.draftError}
                    onChange={(e) => {
                      updateField("registration", e.target.value);
                      setIncoming(null);
                      setValue("");
                    }}
                  />
                </label>
                <label>
                  {t.operator}
                  <input
                    value={draft.operator}
                    maxLength={80}
                    onChange={(e) => updateField("operator", e.target.value)}
                  />
                </label>
                <label>
                  {t.date}
                  <input
                    type="date"
                    value={draft.inspectionDate}
                    onChange={(e) =>
                      updateField("inspectionDate", e.target.value)
                    }
                  />
                </label>
                <label>
                  {t.odometer}
                  <input
                    inputMode="numeric"
                    value={draft.odometerInput}
                    maxLength={7}
                    onChange={(e) =>
                      updateField("odometerInput", e.target.value)
                    }
                  />
                </label>
                <label>
                  {t.axles}
                  <select
                    value={draft.axleCount}
                    disabled={draft.readings.length > 0 || !!initial.draftError}
                    onChange={(e) => {
                      const count = Number(e.target.value);
                      persist({
                        ...draftRef.current,
                        axleCount: count,
                        wheelLayout: defaultWheelLayout(count),
                      });
                      selectPosition({
                        axle: 1,
                        side: "left",
                        wheel: "single",
                      });
                    }}
                  >
                    {[2, 3, 4].map((n) => (
                      <option value={n} key={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t.demoVehicle}
                  <select
                    value=""
                    disabled={draft.readings.length > 0 || !!initial.draftError}
                    onChange={(e) => {
                      const vehicle = vehicles.find(
                        (v) => v.id === e.target.value,
                      );
                      if (vehicle) {
                        // The register entry is carried as the durable link; the
                        // person responsible is always typed by whoever measured.
                        persist({
                          ...draftRef.current,
                          vehicleId: vehicle.id,
                          registration: vehicle.plate,
                          odometerInput: String(vehicle.odometer),
                          inspectionDate: today(),
                        });
                        setValue("");
                        setIncoming(null);
                      }
                    }}
                  >
                    <option value="">—</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.number} · {v.plate}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
              <div className="measure-layout-fields">
                {draft.wheelLayout.map((layout, index) => (
                  <label key={index}>
                    {t.wheels} {index + 1}
                    <select
                      value={layout}
                      disabled={
                        draft.readings.length > 0 || !!initial.draftError
                      }
                      onChange={(e) => {
                        const wheelLayout = [...draft.wheelLayout];
                        wheelLayout[index] = e.target.value as
                          "single" | "dual";
                        persist({ ...draftRef.current, wheelLayout });
                        selectPosition(
                          positionsFor(metric, draft.axleCount, wheelLayout)[0],
                        );
                      }}
                    >
                      <option value="single">{t.singleLayout}</option>
                      <option value="dual">{t.dualLayout}</option>
                    </select>
                  </label>
                ))}
              </div>
              {draft.readings.length > 0 && (
                <p className="measure-help">{t.identityLocked}</p>
              )}
              <div className="measure-workbench">
                <section
                  className="measure-vehicle-panel"
                  aria-label={t.selectPosition}
                >
                  <div className="measure-metric-tabs">
                    {(
                      ["tireTread", "brakePad", "brakeLining"] as Metric[]
                    ).map((m) => (
                      <button
                        type="button"
                        key={m}
                        aria-pressed={metric === m}
                        onClick={() => selectMetric(m)}
                      >
                        {m === "tireTread" ? (
                          <Gauge size={19} />
                        ) : (
                          <Ruler size={19} />
                        )}{" "}
                        {metricLabel(m, language)}
                      </button>
                    ))}
                  </div>
                  <p className="measure-diagram-caption">{t.selectPosition}</p>
                  <div
                    className="measure-truck"
                    style={{ aspectRatio: `360 / ${drawnHeight}` }}
                  >
                    <svg viewBox={`0 0 360 ${drawnHeight}`} aria-hidden="true">
                      <path
                        d={`M135 90V${drawnHeight - 35}M225 90V${drawnHeight - 35}`}
                        stroke="#8090a4"
                        strokeWidth="9"
                      />
                      <path
                        d={`M145 95H215V${drawnHeight - 38}H145Z`}
                        fill="#e9eef4"
                        stroke="#d2dbe6"
                      />
                      <rect
                        x="108"
                        y="10"
                        width="144"
                        height="86"
                        rx="21"
                        fill="#d2e6d8"
                        stroke="#66768c"
                        strokeWidth="2"
                      />
                      <path
                        d="M121 35Q180 20 239 35L230 62H130Z"
                        fill="#1e3a5f"
                      />
                      <path d="M135 75H225" stroke="#66768c" strokeWidth="3" />
                      {Array.from({ length: draft.axleCount }, (_, i) => {
                        // The axle only reaches the outer tyres on an axle that
                        // actually draws a dual pair for the metric on screen.
                        const dualAxle = wheelPositions.some(
                          (p) => p.axle === i + 1 && p.wheel !== "single",
                        );
                        return (
                          <g key={i}>
                            <path
                              d={`M${dualAxle ? 34 : 44} ${125 + i * 76}H${dualAxle ? 326 : 316}`}
                              stroke="#66768c"
                              strokeWidth="7"
                            />
                            <rect
                              x="164"
                              y={113 + i * 76}
                              width="32"
                              height="24"
                              rx="6"
                              fill="#2e5482"
                            />
                            <text
                              x="180"
                              y={154 + i * 76}
                              textAnchor="middle"
                              fontSize="10"
                              fill="#55647a"
                            >
                              {language === "ja"
                                ? `${i + 1}軸`
                                : `${t.axle} ${i + 1}`}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                    {wheelPositions.map((p) => {
                      const key = slotKey(metric, p);
                      const reading = draft.readings.find(
                        (r) => slotKey(r.metric, r.position) === key,
                      );
                      const x =
                        p.side === "left"
                          ? p.wheel === "single"
                            ? 64
                            : p.wheel === "inner"
                              ? 90
                              : 36
                          : p.wheel === "single"
                            ? 296
                            : p.wheel === "inner"
                              ? 270
                              : 324;
                      return (
                        <button
                          type="button"
                          className={`measure-wheel ${p.wheel === "single" ? "single" : "dual"} ${reading ? "recorded" : ""}`}
                          key={key}
                          aria-label={`${positionLabel(p, language, metric)}${reading ? ` ${formatMm(reading.valueMm, language)} mm` : ""}`}
                          aria-pressed={slot === key}
                          onClick={() => selectPosition(p)}
                          style={{
                            left: `${(x / 360) * 100}%`,
                            top: `${((125 + (p.axle - 1) * 76) / drawnHeight) * 100}%`,
                          }}
                        >
                          <span>
                            {reading
                              ? formatMm(reading.valueMm, language)
                              : "—"}
                          </span>
                          <small>mm</small>
                        </button>
                      );
                    })}
                  </div>
                  <div className="measure-diagram-sides">
                    <span>{t.left}</span>
                    <span>{t.rear}</span>
                    <span>{t.right}</span>
                  </div>
                  <p className="measure-help">
                    {isBrakeMetric(metric)
                      ? t.noBrakeAssumption
                      : t.noDiagnosis}
                  </p>
                </section>
                <section className="measure-instrument" aria-label={t.entry}>
                  <div className="measure-selected">
                    <span>{metricLabel(metric, language)}</span>
                    <h2>{positionLabel(position, language, metric)}</h2>
                  </div>
                  <div
                    className="measure-input-tabs"
                    role="group"
                    aria-label={t.source}
                  >
                    {(["manual", "simulator", "bluetooth"] as Source[]).map(
                      (s) => (
                        <button
                          type="button"
                          key={s}
                          aria-pressed={mode === s}
                          onClick={() => selectMode(s)}
                        >
                          {s === "bluetooth" && <Bluetooth size={16} />}{" "}
                          {sourceLabel(s, language)}
                        </button>
                      ),
                    )}
                  </div>
                  {mode === "simulator" && (
                    <div className="measure-simulator">
                      <p>{t.simulatorHelp}</p>
                      <p>{t.simulatorSeparate}</p>
                      <button type="button" onClick={simulate}>
                        {t.simulate}
                      </button>
                    </div>
                  )}
                  {mode === "bluetooth" && (
                    <div className="measure-bt">
                      <p>
                        {!getConfiguredProfile()
                          ? t.noProfile
                          : bluetoothAvailability === "unsupported"
                            ? t.unsupported
                            : bluetoothAvailability === "insecure"
                              ? t.insecure
                              : t.adapterPending}
                      </p>
                      <button
                        type="button"
                        disabled={
                          !getConfiguredProfile() ||
                          connecting ||
                          bluetoothAvailability !== "available"
                        }
                        onClick={
                          deviceName
                            ? () => connection.current?.disconnect()
                            : connect
                        }
                      >
                        {connecting
                          ? t.loading
                          : deviceName
                            ? t.disconnect
                            : t.connect}
                      </button>
                      {deviceName && <p>{deviceName}</p>}
                    </div>
                  )}
                  <label className="measure-value">
                    {t.value}
                    <div>
                      <input
                        inputMode="decimal"
                        value={value}
                        placeholder="0,00"
                        maxLength={6}
                        readOnly={mode !== "manual"}
                        onChange={(e) => {
                          setValue(e.target.value);
                          setIncoming(null);
                        }}
                      />
                      <span>mm</span>
                    </div>
                  </label>
                  <button
                    type="button"
                    className="measure-primary measure-capture"
                    onClick={capture}
                    disabled={!!initial.draftError || !value}
                  >
                    <Check size={20} />
                    {currentDraftReading ? t.replaceDraft : t.capture}
                  </button>
                  <div className="measure-previous">
                    <span>{t.last}</span>
                    {slotHistory[0] ? (
                      <>
                        <strong>
                          {formatMm(slotHistory[0].reading.valueMm, language)}{" "}
                          <small>mm</small>
                        </strong>
                        <span>
                          {slotHistory[0].session.inspectionDate} ·{" "}
                          {sourceLabel(slotHistory[0].reading.source, language)}
                        </span>
                        {value && parseMm(value) !== null && (
                          <p>
                            {t.change}:{" "}
                            {parseMm(value)! - slotHistory[0].reading.valueMm >
                            0
                              ? "+"
                              : ""}
                            {formatMm(
                              parseMm(value)! - slotHistory[0].reading.valueMm,
                              language,
                            )}{" "}
                            mm
                          </p>
                        )}
                      </>
                    ) : (
                      <p>{t.noPrevious}</p>
                    )}
                  </div>
                  <p className="measure-help">{t.trendHelp}</p>
                </section>
              </div>
              <section className="measure-draft">
                <div className="measure-section-title">
                  <h2>{t.draft}</h2>
                  <span>
                    {draft.readings.length}{" "}
                    {t.readings.toLocaleLowerCase(language)}
                  </span>
                </div>
                {draft.readings.length === 0 ? (
                  <p className="measure-empty">{t.noDraft}</p>
                ) : (
                  <div className="measure-reading-chips">
                    {draft.readings.map((r) => (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => {
                          selectMetric(r.metric, r.position);
                        }}
                      >
                        <span>
                          {metricLabel(r.metric, language)} ·{" "}
                          {positionLabel(r.position, language, r.metric)}
                        </span>
                        <strong>{formatMm(r.valueMm, language)} mm</strong>
                        <small
                          className={
                            r.source === "simulator" ? "is-simulated" : ""
                          }
                        >
                          {sourceLabel(r.source, language)}
                        </small>
                      </button>
                    ))}
                  </div>
                )}
                <div className="measure-save-row">
                  <button
                    type="button"
                    onClick={() => {
                      persist({ ...draftRef.current, readings: [] });
                      setValue("");
                      setIncoming(null);
                      setNotice("");
                    }}
                    disabled={!draft.readings.length}
                  >
                    {t.clear}
                  </button>
                  <button
                    type="button"
                    className="measure-primary"
                    onClick={save}
                    disabled={
                      !draft.readings.length ||
                      !!historyError ||
                      !!initial.draftError ||
                      draftError === "STORAGE_CONFLICT"
                    }
                  >
                    <Save size={18} />
                    {t.save}
                  </button>
                </div>
              </section>
            </>
          )}
          {view === "history" && (
            <>
              <div
                className="measure-store-tabs"
                role="group"
                aria-label={t.history}
              >
                {(["real", "demo"] as StoreKind[]).map((kind) => (
                  <button
                    type="button"
                    key={kind}
                    aria-pressed={historyKind === kind}
                    onClick={() => {
                      setHistoryKind(kind);
                      setSelectedId("");
                      setCorrection(null);
                    }}
                  >
                    {kind === "real" ? t.realHistory : t.demoHistory}
                    <span>
                      {(kind === "real" ? store : demoStore).sessions.length}
                    </span>
                  </button>
                ))}
              </div>
              {historyKind === "demo" && (
                <p className="measure-alert measure-demo-note" role="note">
                  {t.demoHistoryNote}
                </p>
              )}
              <div className="measure-history-filter">
                <label>
                  {t.search}
                  <input
                    value={historyQuery}
                    placeholder={t.allVehicles}
                    onChange={(e) => {
                      setHistoryQuery(e.target.value);
                      setSelectedId("");
                      setCorrection(null);
                    }}
                  />
                </label>
                <button type="button" onClick={refreshHistory}>
                  {t.refresh}
                </button>
                <button
                  type="button"
                  onClick={() => copyDownload(visibleStore)}
                  disabled={historyKind === "real" && !!historyError}
                >
                  <Download size={17} />
                  {t.download}
                </button>
              </div>
              <div className="measure-history-layout">
                <section
                  className="measure-session-list"
                  aria-label={t.sessions}
                >
                  {filteredHistory.length === 0 ? (
                    <p className="measure-empty">{t.noHistory}</p>
                  ) : (
                    filteredHistory.map((s) => (
                      <button
                        type="button"
                        key={s.id}
                        aria-pressed={selectedId === s.id}
                        onClick={() => {
                          setSelectedId(s.id);
                          setCorrection(null);
                        }}
                      >
                        <strong>{s.registration}</strong>
                        <span>
                          {s.inspectionDate} ·{" "}
                          {s.odometerKm.toLocaleString(language)} km
                        </span>
                        <small>
                          {activeReadings(s).length}{" "}
                          {t.readings.toLocaleLowerCase(language)}
                          {s.readings.some((r) => r.source === "simulator")
                            ? ` · ${t.simulator}`
                            : ""}
                        </small>
                      </button>
                    ))
                  )}
                </section>
                {selectedSession && (
                  <section className="measure-session-detail">
                    <div className="measure-section-title">
                      <div>
                        <h2>{selectedSession.registration}</h2>
                        <p>
                          {selectedSession.inspectionDate} ·{" "}
                          {selectedSession.operator} ·{" "}
                          {selectedSession.odometerKm.toLocaleString(language)}{" "}
                          km
                        </p>
                      </div>
                      <span>
                        {activeSelected.length} {t.readings}
                      </span>
                    </div>
                    <div className="measure-history-table">
                      <table>
                        <thead>
                          <tr>
                            <th>{t.position}</th>
                            <th>{t.value}</th>
                            <th>{t.source}</th>
                            <th>{t.correction}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeSelected.map((r) => (
                            <tr key={r.id}>
                              <td>
                                <strong>
                                  {metricLabel(r.metric, language)}
                                </strong>
                                <span>
                                  {positionLabel(
                                    r.position,
                                    language,
                                    r.metric,
                                  )}
                                </span>
                              </td>
                              <td className="measure-number">
                                {formatMm(r.valueMm, language)}{" "}
                                <small>mm</small>
                              </td>
                              <td>
                                <span
                                  className={
                                    r.source === "simulator"
                                      ? "is-simulated"
                                      : ""
                                  }
                                >
                                  {sourceLabel(r.source, language)}
                                </span>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  aria-label={`${t.correction} ${metricLabel(r.metric, language)} ${positionLabel(r.position, language, r.metric)}`}
                                  onClick={() => {
                                    setCorrection({
                                      sessionId: selectedSession.id,
                                      reading: r,
                                    });
                                    setCorrectionValue(String(r.valueMm));
                                    setCorrectionReason("remeasurement");
                                    setError("");
                                  }}
                                >
                                  <Pencil size={16} />
                                  {t.correction}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {correction && (
                      <form
                        className="measure-correction"
                        onSubmit={(e) => {
                          e.preventDefault();
                          correct();
                        }}
                      >
                        <h3>
                          {t.correctionTitle}:{" "}
                          {positionLabel(
                            correction.reading.position,
                            language,
                            correction.reading.metric,
                          )}
                        </h3>
                        <p>{t.originalKept}</p>
                        <div>
                          <label>
                            {t.value}
                            <input
                              inputMode="decimal"
                              value={correctionValue}
                              onChange={(e) =>
                                setCorrectionValue(e.target.value)
                              }
                              maxLength={6}
                            />
                          </label>
                          <label>
                            {t.correctionReason}
                            <select
                              value={correctionReason}
                              onChange={(e) =>
                                setCorrectionReason(e.target.value)
                              }
                            >
                              <option value="remeasurement">
                                {t.remeasurement}
                              </option>
                              <option value="inputCorrection">
                                {t.inputCorrection}
                              </option>
                            </select>
                          </label>
                        </div>
                        <button type="submit" className="measure-primary">
                          {t.correct}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCorrection(null)}
                        >
                          {t.cancel}
                        </button>
                      </form>
                    )}
                    {selectedSession.readings.some((r) => r.supersedesId) && (
                      <details className="measure-revisions">
                        <summary>{t.revisions}</summary>
                        {selectedSession.readings.map((r) => (
                          <p key={r.id}>
                            {positionLabel(r.position, language, r.metric)} ·{" "}
                            {formatMm(r.valueMm, language)} mm ·{" "}
                            {sourceLabel(r.source, language)} ·{" "}
                            {new Date(r.capturedAt).toLocaleString(language)}
                            {r.supersedesId
                              ? ` · ${r.correctionReason === "remeasurement" ? t.remeasurement : r.correctionReason === "inputCorrection" ? t.inputCorrection : r.correctionReason}`
                              : ""}
                          </p>
                        ))}
                      </details>
                    )}
                    <div className="measure-detail-actions">
                      <button type="button" onClick={() => setView("report")}>
                        <Printer size={18} />
                        {t.report}
                      </button>
                      <button
                        type="button"
                        className="measure-primary"
                        onClick={() => {
                          setPdfSession(selectedSession);
                          setView("pdf");
                        }}
                      >
                        {t.pdf}
                      </button>
                    </div>
                    <p className="measure-help">{t.pdfHelp}</p>
                  </section>
                )}
              </div>
            </>
          )}
          {view === "report" && selectedSession && (
            <section className="measure-report-view">
              <div className="measure-detail-actions">
                <button type="button" onClick={() => setView("history")}>
                  <ArrowLeft size={17} />
                  {t.history}
                </button>
                <button
                  type="button"
                  className="measure-primary"
                  disabled={reportIssues.length > 0}
                  onClick={() => window.print()}
                >
                  <Printer size={18} />
                  {t.print}
                </button>
              </div>
              {reportIssues.length > 0 && (
                <p className="measure-alert" role="alert">
                  {t.reportPending}
                </p>
              )}
              <MeasurementReport session={selectedSession} />
            </section>
          )}
        </main>
      </div>
      <div className="measurement-print" lang="ja">
        {view === "report" && selectedSession && reportIssues.length === 0 ? (
          <MeasurementReport session={selectedSession} />
        ) : (
          <p>測定表を開いて、入力内容を確認してから印刷してください。</p>
        )}
      </div>
    </div>
  );
}

// Memoizado pelo mesmo motivo do PdfPreview: o shell renderiza a cada tecla.
export default memo(MeasurementStudio);
