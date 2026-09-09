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
  items,
  loadState,
  newInspection,
  saveState,
  simulateSync,
  statusLabels,
  STORAGE_KEY,
  updateAnswer,
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

type Page =
  "home" | "setup" | "checklist" | "review" | "history" | "queue" | "report";
const sections = [
  "Exterior",
  "Pneus e rodas",
  "Motor e fluidos",
  "Cabine e segurança",
];
const statuses: Status[] = [
  "OK",
  "Attention",
  "Repair",
  "Critical",
  "NotApplicable",
];
const time = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
const km = (n: number) => n.toLocaleString("pt-BR");

function TruckDrawing() {
  return (
    <svg
      className="truck-drawing"
      viewBox="0 0 440 190"
      role="img"
      aria-label="Ilustração de caminhão da frota de teste"
    >
      <path d="M15 154H420" stroke="#b6c7ca" strokeWidth="2" />
      <rect
        x="48"
        y="27"
        width="226"
        height="107"
        rx="5"
        fill="#dce8e8"
        stroke="#709698"
        strokeWidth="3"
      />
      <path
        d="M67 45H255M67 66H255M67 87H255M67 108H255"
        stroke="#b7cecf"
        strokeWidth="2"
      />
      <path d="M280 65H334L375 108V138H280Z" fill="#267079" />
      <path d="M293 77H329L352 104H293Z" fill="#e9f4f4" />
      <path d="M282 118H368" stroke="#bde2dc" strokeWidth="3" />
      <rect x="40" y="133" width="341" height="13" rx="3" fill="#214b52" />
      <circle cx="109" cy="144" r="23" fill="#263f48" />
      <circle cx="109" cy="144" r="10" fill="#cad7da" />
      <circle cx="232" cy="144" r="23" fill="#263f48" />
      <circle cx="232" cy="144" r="10" fill="#cad7da" />
      <circle cx="332" cy="144" r="23" fill="#263f48" />
      <circle cx="332" cy="144" r="10" fill="#cad7da" />
      <text x="91" y="77" fontSize="21" fontWeight="700" fill="#3e7378">
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
        error: "",
      };
    } catch {
      return {
        data: emptyState(),
        raw: null,
        error:
          "Os dados locais não puderam ser lidos. Eles foram preservados. Use outro perfil do Chrome para uma demonstração vazia ou solicite a recuperação.",
      };
    }
  });
  const [data, setData] = useState<DemoState>(initial.data);
  const dataRef = useRef(data);
  const storedRef = useRef(initial.raw);
  const [page, setPage] = useState<Page>("home");
  const [activeId, setActiveId] = useState("");
  const [vehicleId, setVehicleId] = useState(vehicles[0].id);
  const [odometer, setOdometer] = useState(String(vehicles[0].odometer));
  const [operator, setOperator] = useState("Operador de teste");
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
        setError(
          "Outra gravação foi detectada em outra aba. Esta edição não foi salva. Exporte sua cópia antes de recarregar e use uma única aba.",
        );
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
      setError(
        "Não salvo. O navegador não confirmou a gravação. Mantenha esta página aberta e tente salvar novamente.",
      );
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
      if (!latest) throw new Error("Rascunho não encontrado.");
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
        setError(
          "Limite de fotos desta demonstração atingido. A nova imagem não foi adicionada; o rascunho foi preservado. Escolha um arquivo menor.",
        );
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
      if (!odometer.trim())
        throw new Error("Informe a quilometragem observada.");
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
      setError(
        "Escolha uma foto JPG ou PNG de até 1 MB para esta demonstração.",
      );
      return;
    }
    const target = active.id;
    const targetItem = item.id;
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Não foi possível ler a foto."));
        r.readAsDataURL(file);
      });
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () =>
          reject(new Error("A imagem está inválida ou não pode ser aberta."));
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
      setNotice(
        "Modo sem rede de teste: os registros continuam neste navegador.",
      );
      return;
    }
    if (persist(simulateSync(dataRef.current)))
      setNotice(
        "Envio simulado concluído. Nenhum dado foi enviado a um servidor.",
      );
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
  if (initial.error)
    return (
      <main className="fatal">
        <ShieldAlert size={40} />
        <h1>Dados preservados</h1>
        <p role="alert">{initial.error}</p>
      </main>
    );
  return (
    <div className="demo-shell">
      <aside
        className="sidebar"
        inert={Boolean(drawingSignature || annotation || preview)}
      >
        <a className="brand" href="/demo.html">
          <span className="brand-mark">ス</span>
          <span>
            ススム<strong>SUSUMU CHECK</strong>
          </span>
        </a>
        <div className="workshop">
          Oficina de teste<span>点検 · Inspeção de veículos</span>
        </div>
        <nav aria-label="Navegação principal">
          <button
            className={
              ["home", "setup", "checklist", "review"].includes(page)
                ? "selected"
                : ""
            }
            onClick={() => setPage("home")}
          >
            <Home size={20} />
            Minha oficina
          </button>
          <button
            className={page === "queue" ? "selected" : ""}
            onClick={() => setPage("queue")}
          >
            <Clock3 size={20} />
            Fila de envio<span className="nav-count">{pending.length}</span>
          </button>
          <button
            className={["history", "report"].includes(page) ? "selected" : ""}
            onClick={() => setPage("history")}
          >
            <History size={20} />
            Histórico
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="avatar">OT</div>
          <div>
            Operador de teste<small>Sessão demonstrativa</small>
          </div>
        </div>
      </aside>
      <div
        className="workspace"
        inert={Boolean(drawingSignature || annotation || preview)}
      >
        <header className="topbar">
          <span>
            Oficina <span className="slash">/</span> Tenken
          </span>
          <div>
            <span className="demo-tag">Demonstração local</span>
            <button
              className={`connection ${online ? "" : "offline"}`}
              onClick={() => {
                setOnline(!online);
                setNotice(
                  !online
                    ? "Rede de teste reativada. Use Simular envio para visualizar a fila."
                    : "Modo sem rede de teste ativado. Continue preenchendo normalmente.",
                );
              }}
            >
              {online ? <Wifi size={17} /> : <WifiOff size={17} />}{" "}
              {online ? "Rede de teste" : "Sem rede (simulado)"}
            </button>
          </div>
        </header>
        <main>
          {error && (
            <div className="alert danger" role="alert">
              {error}
              {unsaved && !conflict && (
                <button onClick={() => persist(dataRef.current)}>
                  Tentar salvar novamente
                </button>
              )}
              {unsaved && (
                <button onClick={exportData}>Exportar cópia em memória</button>
              )}
              {!unsaved && (
                <button aria-label="Fechar aviso" onClick={() => setError("")}>
                  <X size={16} />
                </button>
              )}
            </div>
          )}
          {notice && (
            <div className="alert info" role="status">
              {notice}
              <button
                aria-label="Fechar informação"
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
                  <h1>Vamos começar o Tenken?</h1>
                  <p>Selecione o veículo e registre cada ponto da inspeção.</p>
                </div>
                <span className="date-label">Piloto · 1 tablet</span>
              </div>
              <section className="welcome-panel">
                <div>
                  <span className="small-label">Sua bancada de inspeção</span>
                  <h2>
                    Um veículo por vez.
                    <br />
                    Cada detalhe registrado.
                  </h2>
                  <p>
                    Teste o fluxo com o mouse. Você pode parar e retomar o
                    rascunho neste Chrome.
                  </p>
                  <div className="welcome-stats">
                    <span>
                      <strong>{drafts.length}</strong> em andamento
                    </span>
                    <span>
                      <strong>{finalized.length}</strong> finalizadas
                    </span>
                    <span>
                      <strong>{pending.length}</strong> na fila de teste
                    </span>
                  </div>
                </div>
                <TruckDrawing />
              </section>
              {drafts.length > 0 && (
                <section className="draft-strip">
                  <h2>
                    <Clock3 size={20} /> Continue de onde parou
                  </h2>
                  {drafts.map((i) => (
                    <button
                      key={i.id}
                      onClick={() => open(i)}
                      aria-label={`Continuar ${vehicles.find((v) => v.id === i.vehicleId)!.number}`}
                    >
                      <b>
                        {vehicles.find((v) => v.id === i.vehicleId)!.number}
                      </b>
                      <span>
                        {items.filter((it) => i.answers[it.id]?.status).length}/
                        {items.length} itens · {time(i.startedAt)}
                      </span>
                      <ArrowRight size={18} />
                    </button>
                  ))}
                </section>
              )}
              <div className="section-heading">
                <div>
                  <h2>Veículos disponíveis</h2>
                  <p>Cadastros fictícios para explorar a demonstração</p>
                </div>
                <label className="search">
                  <Search size={19} />
                  <input
                    aria-label="Pesquisar veículo"
                    placeholder="Número ou placa"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </div>
              <div className="vehicle-grid">
                {vehicles
                  .filter((v) =>
                    `${v.number} ${v.plate} ${v.description}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((v) => (
                    <article className="vehicle-card" key={v.id}>
                      <div className="vehicle-card-top">
                        <span className="vehicle-icon">
                          <Truck size={27} />
                        </span>
                        <span className="pill neutral">Dados de teste</span>
                      </div>
                      <h3>{v.number}</h3>
                      <p>{v.description}</p>
                      <div className="plate">{v.plate}</div>
                      <div className="vehicle-meta">
                        <span>Última leitura</span>
                        <b>{km(v.odometer)} km</b>
                      </div>
                      <button
                        className="primary full"
                        aria-label={`Inspecionar ${v.number}`}
                        onClick={() => setup(v)}
                      >
                        Iniciar inspeção
                        <ArrowRight size={18} />
                      </button>
                    </article>
                  ))}
              </div>
              {vehicles.filter((v) =>
                `${v.number} ${v.plate} ${v.description}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              ).length === 0 && (
                <div className="empty">
                  Nenhum veículo encontrado. Tente o número 714.
                </div>
              )}
              <p className="footnote">
                <ShieldAlert size={16} /> Ambiente demonstrativo com dados
                fictícios. O checklist precisa ser validado pela oficina antes
                do uso real.
              </p>
            </>
          )}
          {page === "setup" && (
            <>
              <button className="back" onClick={() => setPage("home")}>
                <ArrowLeft size={17} />
                Voltar aos veículos
              </button>
              <div className="page-heading">
                <div>
                  <h1>Confirme o veículo</h1>
                  <p>Confira a identificação antes de iniciar o registro.</p>
                </div>
              </div>
              <div className="setup-grid">
                <section className="panel identity">
                  <TruckDrawing />
                  <h2>Veículo {vehicle.number}</h2>
                  <p>{vehicle.description}</p>
                  <div className="plate">{vehicle.plate}</div>
                  <p>
                    Última leitura: <b>{km(vehicle.odometer)} km</b>
                  </p>
                  <span className="pill neutral">Cadastro sintético</span>
                </section>
                <section className="panel form-panel">
                  <h2>Nova inspeção</h2>
                  <label>
                    Operador de teste
                    <input
                      value={operator}
                      maxLength={80}
                      onChange={(e) => setOperator(e.target.value)}
                    />
                  </label>
                  <label>
                    Quilometragem observada (km)
                    <input
                      inputMode="numeric"
                      type="number"
                      min={vehicle.odometer}
                      step="1"
                      value={odometer}
                      onChange={(e) => setOdometer(e.target.value)}
                    />
                  </label>
                  <p className="field-help">
                    Leitura inferior à cadastrada exige conferência. Não invente
                    uma quilometragem.
                  </p>
                  <div className="template-info">
                    <ClipboardCheck size={24} />
                    <div>
                      <b>Tenken demonstrativo · versão 1</b>
                      <p>12 itens · 4 seções · assinatura de teste</p>
                    </div>
                  </div>
                  <button
                    className="primary full"
                    disabled={unsaved}
                    onClick={start}
                  >
                    Iniciar Tenken
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
                    Voltar à oficina
                  </button>
                  <h1>
                    Tenken <span>{vehicle.number}</span>
                  </h1>
                  <p>
                    {vehicle.plate} · {km(active.odometer)} km ·{" "}
                    {active.operator}
                  </p>
                </div>
                <div className="save-indicator">
                  {unsaved ? (
                    <ShieldAlert size={18} />
                  ) : (
                    <CheckCheck size={18} />
                  )}{" "}
                  {unsaved ? "Alterações não salvas" : "Salvo neste navegador"}
                  <small>Rascunho · versão 1</small>
                </div>
              </div>
              <div className="inspection-layout">
                <aside className="checklist-nav">
                  <div className="progress-label">
                    <b>
                      {answered} de {items.length} respondidos
                    </b>
                    <span>{Math.round((answered / items.length) * 100)}%</span>
                  </div>
                  <progress max={items.length} value={answered} />
                  {sections.map((section) => (
                    <div className="check-section" key={section}>
                      <h2>{section}</h2>
                      {items.map(
                        (it, index) =>
                          it.section === section && (
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
                              {it.label}
                            </button>
                          ),
                      )}
                    </div>
                  ))}
                </aside>
                <section className="panel item-panel">
                  <div className="section-heading">
                    <span className="small-label">{item.section}</span>
                    <span className="pill neutral">
                      Item {itemIndex + 1} / {items.length}
                    </span>
                  </div>
                  <h2>{item.label}</h2>
                  <p className="item-hint">{item.hint}</p>
                  <fieldset className="status-field">
                    <legend>Qual é a condição deste item?</legend>
                    <div className="status-options">
                      {statuses
                        .filter((s) => s !== "NotApplicable" || item.allowNA)
                        .map((s) => (
                          <button
                            key={s}
                            className={`status-option ${s} ${answer.status === s ? "chosen" : ""}`}
                            aria-pressed={answer.status === s}
                            aria-label={statusLabels[s]}
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
                            {statusLabels[s]}
                          </button>
                        ))}
                    </div>
                  </fieldset>
                  {answer.status === "Critical" && (
                    <div className="alert danger">
                      <ShieldAlert size={22} />
                      <div>
                        <b>Comunique a ocorrência ao responsável.</b>
                        <p>
                          Finalizar a inspeção não libera o veículo para
                          circular.
                        </p>
                      </div>
                    </div>
                  )}
                  {item.unit && answer.status !== "NotApplicable" && (
                    <label className="measurement">
                      Medição ({item.unit})
                      <input
                        type="text"
                        inputMode="decimal"
                        value={answer.value}
                        onChange={(e) => patch({ value: e.target.value })}
                      />
                      <span className="field-help">
                        Faixa de entrada de teste: {item.min} a {item.max}{" "}
                        {item.unit}. Não é critério de aprovação mecânica.
                      </span>
                    </label>
                  )}
                  <label className="notes-label">
                    Observação do item
                    <textarea
                      rows={3}
                      value={answer.notes}
                      placeholder="Descreva o que você observou…"
                      onChange={(e) => patch({ notes: e.target.value })}
                    />
                  </label>
                  <div className="photo-section">
                    <div>
                      <h3>Evidências</h3>
                      <p>
                        Adicione uma foto do computador e anote com o mouse.
                      </p>
                    </div>
                    <label
                      className={`upload-button ${busy ? "disabled" : ""}`}
                    >
                      <Camera size={18} />
                      {busy ? "Lendo foto…" : "Adicionar foto"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        disabled={busy}
                        aria-label="Adicionar foto"
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
                              name: "Pneu — imagem sintética de teste",
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
                    Usar imagem de teste
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
                              ? "Original preservado"
                              : "Cópia anotada"}
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
                              Anotar cópia
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
                      Anterior
                    </button>
                    {itemIndex < items.length - 1 ? (
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() => setItemIndex(itemIndex + 1)}
                      >
                        Próximo item
                        <ArrowRight size={17} />
                      </button>
                    ) : (
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() => setPage("review")}
                      >
                        Revisar inspeção
                      </button>
                    )}
                  </div>
                </section>
              </div>
              {itemIndex < items.length - 1 && (
                <div className="review-bar">
                  <span>
                    Todos os itens precisam de uma resposta explícita.
                  </span>
                  <button disabled={busy} onClick={() => setPage("review")}>
                    <ClipboardCheck size={18} />
                    Revisar inspeção
                  </button>
                </div>
              )}
            </>
          )}
          {page === "review" && active && (
            <>
              <button className="back" onClick={() => setPage("checklist")}>
                <ArrowLeft size={17} />
                Voltar ao checklist
              </button>
              <div className="page-heading">
                <div>
                  <h1>Revisar inspeção</h1>
                  <p>
                    Veículo {vehicle.number} · {answered}/{items.length} itens
                    respondidos
                  </p>
                </div>
                <span className="pill warning">
                  {problems.length} ocorrências
                </span>
              </div>
              <div className="review-grid">
                <section className="panel">
                  <h2>Resumo do Tenken</h2>
                  <ResultList
                    inspection={active}
                    onItem={(index) => {
                      setItemIndex(index);
                      setPage("checklist");
                    }}
                  />
                  <h3>Assinatura de teste</h3>
                  <p className="field-help">
                    Exigida neste exemplo. A regra operacional será definida
                    pela oficina.
                  </p>
                  {active.signature ? (
                    <div className="signature-saved">
                      <img
                        src={active.signature}
                        alt="Assinatura de teste salva"
                      />
                      <button onClick={() => setDrawingSignature(true)}>
                        Refazer assinatura
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setDrawingSignature(true)}>
                      Desenhar assinatura com o mouse
                    </button>
                  )}
                </section>
                <aside className="panel finish-panel">
                  <FileCheck2 size={32} />
                  <h2>Encerrar o registro</h2>
                  <p>
                    Finalizar não libera o veículo. O registro fica somente para
                    leitura.
                  </p>
                  {problems.some(
                    (it) => active.answers[it.id].status === "Critical",
                  ) && (
                    <div className="alert danger">
                      Há item crítico. Comunique ao responsável da oficina.
                    </div>
                  )}
                  <div className="validation-list" aria-live="polite">
                    {issues(active).length ? (
                      <>
                        <h3>Pendências para finalizar</h3>
                        <ul>
                          {issues(active).map((s, index) => (
                            <li key={index}>{s}</li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p className="valid">
                        <CheckCheck size={18} />
                        Registro pronto para finalizar.
                      </p>
                    )}
                  </div>
                  <button
                    className="primary full"
                    disabled={issues(active).length > 0 || unsaved || busy}
                    onClick={() => {
                      try {
                        const done = finalizeInspection(active);
                        if (replace(done, false)) {
                          setPage("report");
                          setNotice(
                            "Registro finalizado neste navegador. Envio ao escritório ainda não simulado.",
                          );
                        }
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Finalizar registro
                  </button>
                  <p className="field-help">
                    O envio é uma etapa separada. Nesta demonstração ele é
                    apenas simulado.
                  </p>
                </aside>
              </div>
            </>
          )}
          {(page === "history" || page === "queue") && (
            <>
              <div className="page-heading">
                <div>
                  <h1>
                    {page === "history"
                      ? "Histórico de inspeções"
                      : "Fila de envio"}
                  </h1>
                  <p>
                    {page === "history"
                      ? "Registros finalizados nesta demonstração."
                      : "Visualize como os registros aguardam o envio ao escritório."}
                  </p>
                </div>
                {page === "queue" && (
                  <button
                    className="primary"
                    disabled={!online || pending.length === 0 || unsaved}
                    onClick={synchronize}
                  >
                    <Wifi size={18} />
                    Simular envio
                  </button>
                )}
              </div>
              <div className="alert info">
                {page === "queue"
                  ? "Simulação: nenhum dado é enviado ao servidor. O botão de rede não desliga o Wi-Fi do PC."
                  : "Os dados ficam apenas neste perfil e endereço do Chrome. Limpar dados do navegador remove a demonstração."}
              </div>
              {(page === "queue" ? pending : finalized).length === 0 ? (
                <div className="empty">
                  <FileCheck2 size={40} />
                  <h2>
                    {page === "queue"
                      ? "Nenhum envio pendente"
                      : "Nenhuma inspeção finalizada"}
                  </h2>
                  <p>Conclua um Tenken para ver o registro aqui.</p>
                  <button onClick={() => setPage("home")}>
                    Ir para minha oficina
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
                          Veículo{" "}
                          {vehicles.find((v) => v.id === i.vehicleId)!.number}
                        </b>
                        <small>
                          {time(i.finalizedAt!)} · {i.operator}
                        </small>
                      </span>
                      <span
                        className={`pill ${i.sent ? "success" : "warning"}`}
                      >
                        {i.sent ? "Envio simulado" : "Pendente de simulação"}
                      </span>
                      <ArrowRight size={19} />
                    </button>
                  ))}
                </div>
              )}
              {page === "history" && (
                <button onClick={exportData}>
                  Exportar dados da demonstração (JSON)
                </button>
              )}
            </>
          )}
          {page === "report" && active && (
            <>
              <div className="page-heading">
                <div>
                  <span className="pill success">
                    <CheckCheck size={16} />
                    Registro finalizado
                  </span>
                  <h1>Tenken do veículo {vehicle.number}</h1>
                  <p>
                    {vehicle.plate} · {km(active.odometer)} km ·{" "}
                    {active.operator} · {time(active.finalizedAt!)}
                  </p>
                </div>
                <button onClick={() => window.print()}>
                  Imprimir relatório
                </button>
              </div>
              <div className="alert info">
                Demonstração local ·{" "}
                {active.sent
                  ? "Envio simulado, sem servidor."
                  : "Envio de teste pendente."}{" "}
                Finalizar não libera o veículo.
              </div>
              <section className="panel report">
                <h2>Tenken demonstrativo · versão 1</h2>
                <ResultList inspection={active} />
                {active.signature && (
                  <div className="signature-saved">
                    <h3>Assinatura de teste</h3>
                    <img src={active.signature} alt="Assinatura de teste" />
                  </div>
                )}
                <p>Identificador: {active.id}</p>
              </section>
              <div className="actions">
                <button className="primary" onClick={() => setPage("home")}>
                  Voltar à oficina
                </button>
                {!active.sent && (
                  <button onClick={() => setPage("queue")}>
                    Ver fila de envio
                  </button>
                )}
                <button onClick={exportData}>Exportar dados (JSON)</button>
              </div>
            </>
          )}
        </main>
        <footer>
          ススム · Vehicle Check
          <span>
            Protótipo para avaliação de fluxo no Chrome · dados fictícios
          </span>
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
                ? "Assinatura de teste"
                : annotation
                  ? "Anotar cópia da foto"
                  : "Visualizar foto"
            }
          >
            <div className="section-heading">
              <h2>
                {drawingSignature
                  ? "Assinatura de teste"
                  : annotation
                    ? "Anotar cópia da foto"
                    : preview?.kind === "Original"
                      ? "Foto original"
                      : "Cópia anotada"}
              </h2>
              <button
                aria-label="Fechar janela"
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
                            name: `Anotação de ${annotation.name}`,
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
  );
}

function ResultList({
  inspection,
  onItem,
}: {
  inspection: Inspection;
  onItem?: (index: number) => void;
}) {
  return (
    <div className="result-list">
      {items.map((it, index) => {
        const a = inspection.answers[it.id];
        return (
          <div className="result-row" key={it.id}>
            <div className="result-main">
              {onItem ? (
                <button className="text-button" onClick={() => onItem(index)}>
                  {it.label}
                </button>
              ) : (
                <b>{it.label}</b>
              )}
              <span className={`pill ${a?.status ?? "neutral"}`}>
                {a?.status ? statusLabels[a.status] : "Sem resposta"}
              </span>
            </div>
            {it.unit && a?.status !== "NotApplicable" && (
              <p>
                Medição: {a?.value || "Não informada"} {it.unit}
              </p>
            )}
            {a?.notes && <p className="preserve-lines">{a.notes}</p>}
            {a?.photos.length > 0 && (
              <div className="report-photos">
                {a.photos.map((p) => (
                  <figure key={p.id}>
                    <img src={p.dataUrl} alt={p.name} />
                    <figcaption>
                      {p.kind === "Original" ? "Original" : "Cópia anotada"}
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
