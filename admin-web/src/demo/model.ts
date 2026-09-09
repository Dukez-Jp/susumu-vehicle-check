/**
 * Domínio da DEMONSTRAÇÃO local (Windows/Chrome, mouse, dados sintéticos).
 *
 * Não é o produto Android nem fala com servidor: `simulateSync` apenas marca no
 * próprio navegador o que "seria" enviado. Tudo aqui é objeto simples e
 * serializável, para caber em `localStorage` e sobreviver a um F5.
 *
 * Regras que este módulo leva a sério, por serem as mesmas do esboço:
 * original de foto nunca é reescrito, registro finalizado não muda, gravação só
 * é anunciada depois de aceita, e conteúdo guardado inválido é recusado em vez
 * de "consertado" por suposição.
 */

export type Status =
  "OK" | "Attention" | "Repair" | "Critical" | "NotApplicable";

export interface Vehicle {
  id: string;
  number: string;
  plate: string;
  description: string;
  odometer: number;
}

export interface Item {
  id: string;
  section: string;
  label: string;
  hint: string;
  unit?: string;
  min?: number;
  max?: number;
  allowNA: boolean;
}

export interface Photo {
  id: string;
  name: string;
  dataUrl: string;
  kind: "Original" | "Annotation";
  originalId?: string;
}

export interface Answer {
  status?: Status;
  value: string;
  notes: string;
  photos: Photo[];
}

export interface Inspection {
  id: string;
  vehicleId: string;
  odometer: number;
  operator: string;
  startedAt: string;
  finalizedAt?: string;
  state: "Draft" | "Finalized";
  sent: boolean;
  answers: Record<string, Answer>;
  signature?: string;
}

export interface DemoState {
  version: 1;
  inspections: Inspection[];
}

export const statusLabels: Record<Status, string> = {
  OK: "OK",
  Attention: "Atenção",
  Repair: "Reparar",
  Critical: "Crítico",
  NotApplicable: "N/A",
};

const STATUSES = Object.keys(statusLabels) as Status[];

/** Chave própria da demonstração, para não colidir com nada do produto. */
export const STORAGE_KEY = "susumu.tenken.demo.v1";

/** Frota sintética. Nenhuma placa ou veículo real. */
export const vehicles: Vehicle[] = [
  {
    id: "v-714",
    number: "714",
    plate: "DEMO-714",
    description: "Caminhão baú 3/4 — dado sintético",
    odometer: 182450,
  },
  {
    id: "v-208",
    number: "208",
    plate: "DEMO-208",
    description: "Caminhão toco — dado sintético",
    odometer: 96310,
  },
  {
    id: "v-431",
    number: "431",
    plate: "DEMO-431",
    description: "Cavalo mecânico — dado sintético",
    odometer: 254870,
  },
];

/**
 * Checklist sintético de demonstração: 12 itens em 4 seções. Os limites das
 * duas medições são faixa de digitação plausível, NÃO diagnóstico mecânico.
 */
export const items: Item[] = [
  {
    id: "ext-farois",
    section: "Exterior",
    label: "Faróis, lanternas e setas",
    hint: "Acender e conferir cada lâmpada, inclusive freio e ré.",
    allowNA: false,
  },
  {
    id: "ext-parabrisa",
    section: "Exterior",
    label: "Para-brisa, palhetas e retrovisores",
    hint: "Trincas no campo de visão, palhetas ressecadas, espelhos firmes.",
    allowNA: false,
  },
  {
    id: "ext-carroceria",
    section: "Exterior",
    label: "Carroceria, portas e degraus",
    hint: "Amassados novos, portas que não fecham, degrau solto.",
    allowNA: false,
  },
  {
    id: "pneu-sulco",
    section: "Pneus e rodas",
    label: "Profundidade do sulco — eixo dianteiro",
    hint: "Medir no ponto mais gasto da banda de rodagem; registre o que leu, inclusive 0.",
    unit: "mm",
    // Faixa de digitação plausível, não diagnóstico: um pneu realmente gasto
    // precisa ser registrável. O limite superior só barra erro de digitação.
    min: 0,
    max: 20,
    allowNA: false,
  },
  {
    id: "pneu-estepe",
    section: "Pneus e rodas",
    label: "Estepe — profundidade do sulco",
    hint: "Se o veículo não tiver estepe, marque N/A.",
    unit: "mm",
    min: 0,
    max: 20,
    allowNA: true,
  },
  {
    id: "roda-porcas",
    section: "Pneus e rodas",
    label: "Porcas, parafusos e aros",
    hint: "Marca de porca girada, aro trincado, prisioneiro faltando.",
    allowNA: false,
  },
  {
    id: "motor-oleo",
    section: "Motor e fluidos",
    label: "Nível do óleo do motor",
    hint: "Conferir na vareta com o motor frio e nivelado.",
    allowNA: false,
  },
  {
    id: "motor-arrefecimento",
    section: "Motor e fluidos",
    label: "Líquido de arrefecimento",
    hint: "Nível no reservatório e estado das mangueiras.",
    allowNA: false,
  },
  {
    id: "motor-vazamentos",
    section: "Motor e fluidos",
    label: "Vazamentos visíveis",
    hint: "Óleo, combustível, água ou ar no compartimento e no chão.",
    allowNA: false,
  },
  {
    id: "cab-freio",
    section: "Cabine e segurança",
    label: "Pedal de freio e freio de estacionamento",
    hint: "Curso do pedal, firmeza e retenção na rampa.",
    allowNA: false,
  },
  {
    id: "cab-cinto",
    section: "Cabine e segurança",
    label: "Cintos de segurança e buzina",
    hint: "Travamento do cinto, fita íntegra, buzina audível.",
    allowNA: false,
  },
  {
    id: "cab-extintor",
    section: "Cabine e segurança",
    label: "Extintor, triângulo e macaco",
    hint: "Se o equipamento não for exigido neste veículo, marque N/A.",
    allowNA: true,
  },
];

export function emptyState(): DemoState {
  return { version: 1, inspections: [] };
}

function identifier(): string {
  const generator = globalThis.crypto;
  if (generator && typeof generator.randomUUID === "function") {
    return generator.randomUUID();
  }
  return `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function findVehicle(vehicleId: string): Vehicle | undefined {
  return vehicles.find((vehicle) => vehicle.id === vehicleId);
}

function findItem(itemId: string): Item | undefined {
  return items.find((item) => item.id === itemId);
}

function isWholeNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value)
  );
}

/** Aceita apenas imagem embutida; recusa `javascript:` e texto solto. */
function isImageDataUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  );
}

/**
 * Um único separador decimal, vírgula ou ponto. Sem agrupamento de milhar, sem
 * notação científica, sem espaço: separador ambíguo é recusado, nunca adivinhado.
 */
const DECIMAL = /^-?\d+(?:[.,]\d+)?$/;

/** Número da medição, ou `null` quando o texto não é inequívoco. */
function measurementOf(value: string): number | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!DECIMAL.test(text)) return null;
  const parsed = Number(text.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Vínculo entre fotos de uma mesma resposta: identidade única e cópia anotada
 * apontando para uma original presente. Devolve o primeiro problema ou `null`.
 */
function photoLinkProblem(photos: Photo[]): string | null {
  const seen = new Set<string>();
  for (const photo of photos) {
    if (seen.has(photo.id)) return `foto repetida (${photo.id})`;
    seen.add(photo.id);
  }
  for (const photo of photos) {
    if (photo.kind !== "Annotation") continue;
    const source = photos.find(
      (candidate) => candidate.id === photo.originalId,
    );
    if (!source) {
      return `cópia anotada ${photo.id} sem a foto original correspondente`;
    }
    if (source.kind !== "Original") {
      return `cópia anotada ${photo.id} não aponta para uma foto original`;
    }
  }
  return null;
}

function blankAnswer(): Answer {
  return { status: undefined, value: "", notes: "", photos: [] };
}

function copyPhoto(photo: Photo): Photo {
  const copy: Photo = {
    id: photo.id,
    name: photo.name,
    dataUrl: photo.dataUrl,
    kind: photo.kind,
  };
  if (photo.originalId !== undefined) copy.originalId = photo.originalId;
  return copy;
}

function copyAnswer(answer: Answer): Answer {
  return {
    status: answer.status,
    value: answer.value,
    notes: answer.notes,
    photos: answer.photos.map(copyPhoto),
  };
}

function copyAnswers(answers: Record<string, Answer>): Record<string, Answer> {
  const copy: Record<string, Answer> = {};
  for (const [itemId, answer] of Object.entries(answers)) {
    copy[itemId] = copyAnswer(answer);
  }
  return copy;
}

export function newInspection(
  vehicleId: string,
  odometer: number,
  operator: string,
): Inspection {
  const vehicle = findVehicle(vehicleId);
  if (!vehicle) {
    throw new Error(
      `Veículo ${vehicleId} não existe no catálogo da demonstração.`,
    );
  }
  if (typeof operator !== "string" || operator.trim() === "") {
    throw new Error("Informe o nome do operador antes de iniciar.");
  }
  if (!isWholeNumber(odometer)) {
    throw new Error("A quilometragem precisa ser um número inteiro.");
  }
  if (odometer < vehicle.odometer) {
    throw new Error(
      `A quilometragem não pode ser menor que a última conhecida (${vehicle.odometer} km).`,
    );
  }

  const answers: Record<string, Answer> = {};
  for (const item of items) answers[item.id] = blankAnswer();

  return {
    id: identifier(),
    vehicleId: vehicle.id,
    odometer,
    operator: operator.trim(),
    startedAt: new Date().toISOString(),
    state: "Draft",
    sent: false,
    answers,
  };
}

/**
 * Lista, em português, tudo o que impede finalizar. Ordem estável: quilometragem,
 * itens na ordem do checklist e por fim a assinatura.
 */
export function issues(inspection: Inspection): string[] {
  const problems: string[] = [];
  const vehicle = findVehicle(inspection.vehicleId);

  if (!vehicle) {
    problems.push(
      `Veículo ${inspection.vehicleId} não está no catálogo desta demonstração.`,
    );
  }
  if (!isWholeNumber(inspection.odometer) || inspection.odometer < 0) {
    problems.push("Quilometragem: informe um número inteiro válido.");
  } else if (vehicle && inspection.odometer < vehicle.odometer) {
    problems.push(
      `Quilometragem: não pode ser menor que a última conhecida (${vehicle.odometer} km).`,
    );
  }

  for (const item of items) {
    const where = `${item.section} › ${item.label}`;
    const answer = inspection.answers[item.id];

    if (!answer) {
      problems.push(`${where}: resposta ausente no registro.`);
      continue;
    }
    const linkage = photoLinkProblem(answer.photos);
    if (linkage) {
      problems.push(`${where}: ${linkage}.`);
      continue;
    }
    if (answer.status === undefined) {
      problems.push(`${where}: escolha um status.`);
      continue;
    }
    if (!STATUSES.includes(answer.status)) {
      problems.push(
        `${where}: opção de status desconhecida (${answer.status}).`,
      );
      continue;
    }
    if (answer.status === "NotApplicable" && !item.allowNA) {
      problems.push(`${where}: N/A não é permitido neste item.`);
      continue;
    }
    if (item.unit && answer.status !== "NotApplicable") {
      const parsed = measurementOf(answer.value);
      if (parsed === null) {
        problems.push(
          `${where}: informe a medição em ${item.unit} usando apenas números e uma vírgula ou ponto decimal.`,
        );
      } else if (item.min !== undefined && parsed < item.min) {
        problems.push(
          `${where}: medição abaixo de ${item.min} ${item.unit}; confira a leitura.`,
        );
      } else if (item.max !== undefined && parsed > item.max) {
        problems.push(
          `${where}: medição acima de ${item.max} ${item.unit}; confira a leitura.`,
        );
      }
    }
  }

  for (const itemId of Object.keys(inspection.answers)) {
    if (!findItem(itemId)) {
      problems.push(
        `Resposta para item desconhecido (${itemId}) neste checklist.`,
      );
    }
  }

  if (!isImageDataUrl(inspection.signature)) {
    problems.push(
      "Assinatura obrigatória nesta demonstração: assine antes de finalizar.",
    );
  }

  return problems;
}

export function updateAnswer(
  inspection: Inspection,
  itemId: string,
  patch: Partial<Answer>,
): Inspection {
  if (inspection.state === "Finalized") {
    throw new Error(
      "Inspeção finalizada não pode ser alterada. Crie outro registro.",
    );
  }
  const item = findItem(itemId);
  if (!item) {
    throw new Error(`Item ${itemId} não pertence a este checklist.`);
  }
  if (patch.photos !== undefined && !Array.isArray(patch.photos)) {
    throw new Error("A lista de fotos precisa ser uma lista.");
  }

  const current = inspection.answers[itemId] ?? blankAnswer();
  const updated: Answer = {
    status: "status" in patch ? patch.status : current.status,
    value: patch.value !== undefined ? patch.value : current.value,
    notes: patch.notes !== undefined ? patch.notes : current.notes,
    // Cópia: a original recebida continua intacta para quem ainda a referencia.
    photos: (patch.photos ?? current.photos).map(copyPhoto),
  };

  return {
    ...inspection,
    answers: { ...copyAnswers(inspection.answers), [itemId]: updated },
  };
}

export function finalizeInspection(inspection: Inspection): Inspection {
  if (inspection.state === "Finalized") {
    throw new Error("Esta inspeção já foi finalizada.");
  }
  const problems = issues(inspection);
  if (problems.length > 0) {
    throw new Error(`Não é possível finalizar:\n${problems.join("\n")}`);
  }
  return {
    ...inspection,
    answers: copyAnswers(inspection.answers),
    state: "Finalized",
    finalizedAt: new Date().toISOString(),
  };
}

export function saveState(
  storage: Pick<Storage, "setItem">,
  state: DemoState,
): void {
  let encoded: string;
  try {
    encoded = JSON.stringify(state);
  } catch (error) {
    throw new Error("Não foi possível preparar os dados para gravação.", {
      cause: error,
    });
  }
  try {
    storage.setItem(STORAGE_KEY, encoded);
  } catch (error) {
    // Sem espaço, modo privado ou armazenamento bloqueado: não dizer "salvo".
    throw new Error(
      "O navegador recusou gravar a demonstração; nada foi salvo agora.",
      { cause: error },
    );
  }
}

function reject(reason: string): never {
  throw new Error(
    `Dados da demonstração não foram carregados (${reason}). O conteúdo guardado foi preservado para conferência.`,
  );
}

function readAnswer(raw: unknown, itemId: string): Answer {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    reject(`resposta inválida em ${itemId}`);
  }
  const answer = raw as Record<string, unknown>;
  if (typeof answer.value !== "string" || typeof answer.notes !== "string") {
    reject(`texto inválido em ${itemId}`);
  }
  if (
    answer.status !== undefined &&
    !STATUSES.includes(answer.status as Status)
  ) {
    reject(`status desconhecido em ${itemId}`);
  }
  if (!Array.isArray(answer.photos)) {
    reject(`lista de fotos inválida em ${itemId}`);
  }
  const photos = (answer.photos as unknown[]).map((entry) => {
    if (typeof entry !== "object" || entry === null)
      reject(`foto inválida em ${itemId}`);
    const photo = entry as Record<string, unknown>;
    if (typeof photo.id !== "string" || photo.id === "")
      reject(`foto sem identidade em ${itemId}`);
    if (typeof photo.name !== "string") reject(`foto sem nome em ${itemId}`);
    if (!isImageDataUrl(photo.dataUrl)) reject(`imagem inválida em ${itemId}`);
    if (photo.kind !== "Original" && photo.kind !== "Annotation") {
      reject(`tipo de foto inválido em ${itemId}`);
    }
    if (photo.kind === "Annotation" && typeof photo.originalId !== "string") {
      reject(`cópia anotada sem original em ${itemId}`);
    }
    if (photo.kind === "Original" && photo.originalId !== undefined) {
      reject(`foto original não pode apontar para outra em ${itemId}`);
    }
    return copyPhoto(photo as unknown as Photo);
  });

  const linkage = photoLinkProblem(photos);
  if (linkage) reject(`${linkage} em ${itemId}`);

  return {
    status: answer.status as Status | undefined,
    value: answer.value,
    notes: answer.notes,
    photos,
  };
}

function readInspection(raw: unknown): Inspection {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    reject("inspeção inválida");
  }
  const inspection = raw as Record<string, unknown>;
  const text: Record<string, string> = {};
  for (const field of ["id", "vehicleId", "operator", "startedAt"]) {
    const value = inspection[field];
    if (typeof value !== "string" || value === "")
      reject(`campo ${field} inválido`);
    text[field] = value;
  }
  const odometer = inspection.odometer;
  if (typeof odometer !== "number" || !Number.isFinite(odometer)) {
    reject("quilometragem inválida");
  }
  const state = inspection.state;
  if (state !== "Draft" && state !== "Finalized") reject("estado inválido");
  const sent = inspection.sent;
  if (typeof sent !== "boolean") reject("marcação de envio inválida");
  const finalizedAt = inspection.finalizedAt;
  if (state === "Finalized" && typeof finalizedAt !== "string") {
    reject("finalização sem data");
  }
  if (state === "Draft" && finalizedAt !== undefined) {
    reject("rascunho com data de finalização");
  }
  const signature = inspection.signature;
  if (signature !== undefined && !isImageDataUrl(signature)) {
    reject("assinatura inválida");
  }
  if (
    typeof inspection.answers !== "object" ||
    inspection.answers === null ||
    Array.isArray(inspection.answers)
  ) {
    reject("respostas inválidas");
  }

  const answers: Record<string, Answer> = {};
  for (const [itemId, value] of Object.entries(
    inspection.answers as Record<string, unknown>,
  )) {
    answers[itemId] = readAnswer(value, itemId);
  }

  const restored: Inspection = {
    id: text.id,
    vehicleId: text.vehicleId,
    odometer,
    operator: text.operator,
    startedAt: text.startedAt,
    state,
    sent,
    answers,
  };
  if (typeof finalizedAt === "string") restored.finalizedAt = finalizedAt;
  if (signature !== undefined) restored.signature = signature;
  return restored;
}

/**
 * Lê o que está guardado. Recebe apenas `getItem`: por construção não consegue
 * apagar nem reescrever o conteúdo existente, mesmo quando ele está corrompido.
 */
export function loadState(storage: Pick<Storage, "getItem">): DemoState {
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch (error) {
    throw new Error("Não foi possível ler a demonstração guardada.", {
      cause: error,
    });
  }
  if (raw === null || raw === undefined) return emptyState();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    reject("conteúdo ilegível");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    reject("formato inesperado");
  }
  const state = parsed as Record<string, unknown>;
  if (state.version !== 1)
    reject(`versão não suportada (${String(state.version)})`);
  if (!Array.isArray(state.inspections)) reject("lista de inspeções inválida");

  return {
    version: 1,
    inspections: (state.inspections as unknown[]).map(readInspection),
  };
}

/**
 * Envio SIMULADO: nenhum HTTP, nenhuma autenticação, nenhum servidor. Só marca
 * como enviado o que já foi finalizado; rascunho continua rascunho.
 */
export function simulateSync(state: DemoState): DemoState {
  return {
    version: 1,
    inspections: state.inspections.map((inspection) =>
      inspection.state === "Finalized" && !inspection.sent
        ? {
            ...inspection,
            answers: copyAnswers(inspection.answers),
            sent: true,
          }
        : inspection,
    ),
  };
}
