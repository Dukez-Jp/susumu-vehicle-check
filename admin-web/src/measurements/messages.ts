import { isBrakeMetric, type Metric, type Position, type Source } from "./model";
export type Language = "pt-BR" | "ja";
const pt = {
  title: "Cada roda, uma medida.",
  subtitle: "Pneus e freios com valores registrados e histórico por caminhão.",
  section: "Bancada de medições",
  back: "Voltar à oficina",
  language: "Idioma",
  entry: "Medir",
  history: "Histórico",
  local: "Avaliação local · dados neste navegador",
  vehicle: "Placa ou chassi",
  operator: "Responsável",
  date: "Data da inspeção",
  odometer: "Quilometragem (km)",
  axles: "Número de eixos",
  demoVehicle: "Usar caminhão de exemplo",
  details: "Identificação da medição",
  wheels: "Rodas do eixo",
  singleLayout: "Rodas simples",
  dualLayout: "Rodas duplas",
  front: "Frente do caminhão",
  rear: "Traseira",
  left: "Esquerda",
  right: "Direita",
  axle: "Eixo",
  single: "Simples",
  inner: "Interno",
  outer: "Externo",
  position: "Posição",
  selectPosition: "Selecione a posição no caminhão",
  value: "Valor medido (mm)",
  manual: "Entrada manual",
  simulator: "Simulador",
  bluetooth: "Bluetooth",
  simulatorHelp:
    "Leitura fictícia para experimentar o fluxo. Será identificada como simulação no histórico e na impressão.",
  simulate: "Receber leitura de exemplo",
  capture: "Registrar leitura",
  replaceDraft: "Atualizar leitura do rascunho",
  captured: "Leitura registrada no rascunho.",
  source: "Origem",
  saved: "Medições salvas no histórico.",
  save: "Salvar medições",
  clear: "Limpar leituras do rascunho",
  draft: "Leituras desta inspeção",
  noDraft: "Escolha uma posição e registre a primeira medida.",
  noDiagnosis:
    "O valor medido não aprova o item. A avaliação continua com o mecânico.",
  noBrakeAssumption:
    "Freio a disco usa pastilha; freio a tambor usa lona. Escolha o que o eixo realmente tem e meça só as posições com esse componente.",
  mixedSources:
    "Esta inspeção mistura leitura simulada com leitura real. Comece um rascunho novo para o simulador; ele é guardado em um histórico separado.",
  simulatorSeparate:
    "Leituras do simulador ficam em um histórico de demonstração, separado do histórico real dos caminhões.",
  noProfile:
    "Nenhum instrumento Bluetooth está configurado ainda. Falta identificar o modelo e validar o protocolo do fabricante.",
  realHistory: "Caminhões",
  demoHistory: "Demonstração",
  demoHistoryNote:
    "Estas medições vieram do simulador. Não são medidas de nenhum caminhão.",
  identityLocked:
    "A identificação do veículo e os eixos ficam fixos enquanto houver leituras neste rascunho.",
  invalidValue:
    "Informe de 0 a 100 mm, com até duas casas decimais. Essa faixa valida a digitação, não a condição da peça.",
  invalidSession:
    "Confira placa ou chassi, responsável, data, quilometragem e pelo menos uma leitura.",
  storageError:
    "Não foi possível salvar. As leituras continuam nesta tela. Baixe uma cópia e tente novamente.",
  corrupt:
    "Não foi possível abrir o histórico. Os dados existentes foram preservados.",
  conflict:
    "O histórico mudou em outra aba. Atualize o histórico e tente novamente; as leituras desta tela foram preservadas.",
  draftConflict:
    "O rascunho mudou em outra aba. Baixe uma cópia das alterações desta tela antes de recarregar. Os dados da outra aba serão preservados.",
  alreadySaved:
    "Esta inspeção já foi salva em outra aba. As leituras desta tela já estão no histórico. Baixe uma cópia se quiser conferir e comece um rascunho novo para continuar medindo.",
  newDraft: "Começar rascunho novo",
  download: "Baixar cópia",
  refresh: "Atualizar histórico",
  search: "Buscar caminhão",
  allVehicles: "Todos os caminhões",
  noHistory:
    "Nenhuma medição salva para este caminhão. Registre uma leitura para começar o histórico.",
  sessions: "Inspeções com medições",
  readings: "Leituras",
  last: "Última medição",
  previous: "Anterior",
  change: "Variação",
  noPrevious: "Sem medida anterior comparável",
  trendHelp:
    "Comparação da mesma posição. Uma troca de peça pode aumentar a medida.",
  view: "Abrir medições",
  report: "Ver relatório japonês",
  print: "Imprimir relatório em japonês",
  pdf: "Abrir Tenken de 100 itens",
  pdfHelp:
    "Abre uma ficha própria desta inspeção, com as medições vinculadas. As respostas mecânicas começam em branco.",
  correction: "Retificar",
  correctionTitle: "Retificar leitura",
  correctionReason: "Motivo",
  remeasurement: "Nova medição",
  inputCorrection: "Correção de digitação",
  correct: "Salvar retificação",
  cancel: "Cancelar",
  originalKept: "A leitura original permanece no histórico.",
  revisions: "Histórico de retificações",
  corrected: "Retificação salva. Original preservado.",
  summary: "Medições vinculadas",
  openSummary: "Ver valores por posição",
  linked: "Ficha vinculada às medições desta inspeção",
  bindingError:
    "A identificação desta ficha difere da sessão de medições. A impressão foi bloqueada.",
  loading: "Conectando ao instrumento…",
  connect: "Conectar instrumento",
  disconnect: "Desconectar",
  adapterPending:
    "A conexão será habilitada após identificar o modelo e validar seu protocolo. Você já pode registrar manualmente ou testar o simulador.",
  unsupported:
    "Este navegador não oferece conexão Bluetooth. Use a entrada manual.",
  insecure:
    "Bluetooth requer uma conexão segura. Use a entrada manual neste endereço.",
  btError:
    "A leitura Bluetooth não foi aceita. Verifique o instrumento e tente novamente.",
  received: "Leitura recebida. Confira veículo e posição antes de registrar.",
  pdfOverflow:
    "O resumo de medições excede o espaço do formulário. Confira o relatório detalhado.",
  reportPending:
    "O relatório contém um motivo de retificação que precisa ser conferido em japonês.",
};
const ja: typeof pt = {
  title: "一輪ずつ、測定を記録。",
  subtitle: "タイヤとブレーキの測定値を車両ごとに記録・確認できます。",
  section: "測定作業",
  back: "工場画面へ戻る",
  language: "表示言語",
  entry: "測定",
  history: "履歴",
  local: "評価用 · このブラウザーに保存",
  vehicle: "登録番号又は車台番号",
  operator: "担当者",
  date: "点検年月日",
  odometer: "走行距離（km）",
  axles: "車軸数",
  demoVehicle: "見本車両を使用",
  details: "測定の基本情報",
  wheels: "タイヤ構成・軸",
  singleLayout: "単輪",
  dualLayout: "複輪",
  front: "車両前方",
  rear: "車両後方",
  left: "左",
  right: "右",
  axle: "軸",
  single: "単輪",
  inner: "内輪",
  outer: "外輪",
  position: "測定位置",
  selectPosition: "車両図から測定位置を選択",
  value: "測定値（mm）",
  manual: "手入力",
  simulator: "シミュレーター",
  bluetooth: "Bluetooth",
  simulatorHelp:
    "操作確認用の架空の測定値です。履歴と印刷に模擬測定として表示されます。",
  simulate: "見本の測定値を受信",
  capture: "測定値を記録",
  replaceDraft: "下書きの測定値を更新",
  captured: "下書きに測定値を記録しました。",
  source: "入力方法",
  saved: "測定履歴を保存しました。",
  save: "測定結果を保存",
  clear: "下書きの測定値を消去",
  draft: "今回の測定値",
  noDraft: "位置を選択して最初の測定値を記録してください。",
  noDiagnosis:
    "測定値だけでは点検済みになりません。整備士が別途判断してください。",
  noBrakeAssumption:
    "ディスク・ブレーキはパッド、ドラム・ブレーキはライニングです。実際の装置を選び、その部品がある位置のみ記録してください。",
  mixedSources:
    "この点検に模擬測定と実測定が混在しています。シミュレーターは新しい下書きで使用してください。模擬測定は別の履歴に保存します。",
  simulatorSeparate:
    "シミュレーターの測定値は、実車の履歴とは別の見本履歴に保存します。",
  noProfile:
    "接続できる測定器がまだ登録されていません。型式の特定とメーカー通信仕様の確認が必要です。",
  realHistory: "実車",
  demoHistory: "見本",
  demoHistoryNote:
    "これはシミュレーターの測定値です。実際の車両を測定した記録ではありません。",
  identityLocked:
    "下書きに測定値がある間、車両識別情報と車軸数は変更できません。",
  invalidValue:
    "0～100 mm、少数第2位までで入力してください。入力範囲であり、部品の良否基準ではありません。",
  invalidSession:
    "登録番号、担当者、日付、走行距離、測定値を確認してください。",
  storageError:
    "保存できませんでした。測定値は画面内に保持しています。コピーを保存して再試行してください。",
  corrupt: "履歴を読み込めませんでした。既存データは保持しています。",
  conflict:
    "別のタブで履歴が変更されました。履歴を更新して再試行してください。この画面の測定値は保持しています。",
  draftConflict:
    "別のタブで下書きが変更されました。再読み込みの前に、この画面の変更をダウンロードしてください。別のタブのデータは保持します。",
  alreadySaved:
    "この点検は別のタブで保存済みです。この画面の測定値はすでに履歴にあります。必要であればコピーを保存し、新しい下書きで測定を続けてください。",
  newDraft: "新しい下書きを開始",
  download: "コピーを保存",
  refresh: "履歴を更新",
  search: "車両を検索",
  allVehicles: "全車両",
  noHistory:
    "この車両の測定履歴はありません。測定値を記録すると履歴が表示されます。",
  sessions: "測定を含む点検",
  readings: "測定数",
  last: "直近の測定",
  previous: "前回",
  change: "差分",
  noPrevious: "比較できる前回の測定はありません",
  trendHelp: "同じ位置の比較です。部品交換により測定値が増えることもあります。",
  view: "測定結果を開く",
  report: "日本語の測定表を確認",
  print: "日本語の測定表を印刷",
  pdf: "100項目の点検表を開く",
  pdfHelp:
    "今回の測定に対応する点検表を開きます。点検結果は未記入の状態で開始します。",
  correction: "訂正",
  correctionTitle: "測定値の訂正",
  correctionReason: "訂正理由",
  remeasurement: "再測定",
  inputCorrection: "入力訂正",
  correct: "訂正を保存",
  cancel: "キャンセル",
  originalKept: "元の測定値は履歴に保持します。",
  revisions: "訂正履歴",
  corrected: "訂正を保存しました。元の測定値は保持しています。",
  summary: "関連する測定値",
  openSummary: "位置ごとの測定値を確認",
  linked: "今回の測定記録に対応する点検表",
  bindingError: "点検表の識別情報が測定記録と一致しないため、印刷できません。",
  loading: "測定器に接続中…",
  connect: "測定器に接続",
  disconnect: "切断",
  adapterPending:
    "測定器の型式と通信仕様を確認後、接続を有効にします。手入力とシミュレーターは利用できます。",
  unsupported:
    "このブラウザーはBluetooth接続に対応していません。手入力を使用してください。",
  insecure:
    "Bluetoothには安全な接続が必要です。このアドレスでは手入力を使用してください。",
  btError:
    "Bluetoothの測定値を受け付けられませんでした。測定器を確認して再試行してください。",
  received: "測定値を受信しました。記録前に車両と位置を確認してください。",
  pdfOverflow:
    "測定概要が点検表の記入欄に収まりません。詳細な測定表を確認してください。",
  reportPending: "印刷前に訂正理由の日本語を確認してください。",
};
export const messages = { "pt-BR": pt, ja };
const metricLabels: Record<Language, Record<Metric, string>> = {
  "pt-BR": {
    tireTread: "Sulco do pneu",
    brakePad: "Espessura da pastilha",
    brakeLining: "Espessura da lona",
  },
  ja: {
    tireTread: "タイヤ溝深さ",
    brakePad: "パッド厚さ",
    brakeLining: "ライニング厚さ",
  },
};
export function metricLabel(metric: Metric, language: Language) {
  return metricLabels[language][metric];
}
export function positionLabel(
  position: Position,
  language: Language,
  metric?: Metric,
) {
  const t = messages[language];
  // Pads and linings sit once per side; only a tyre can be inner or outer.
  const perWheel = !metric || !isBrakeMetric(metric);
  const wheel = perWheel ? ` · ${t[position.wheel]}` : "";
  return language === "ja"
    ? `${position.axle}${t.axle} ${t[position.side]}${perWheel ? ` ${t[position.wheel]}` : ""}`
    : `${t.axle} ${position.axle} · ${t[position.side]}${wheel}`;
}
export function sourceLabel(source: Source, language: Language) {
  return messages[language][source];
}
export function formatMm(value: number, language: Language) {
  return value.toLocaleString(language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
