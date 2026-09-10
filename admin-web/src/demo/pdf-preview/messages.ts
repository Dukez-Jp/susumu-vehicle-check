import type { Action, HeaderFields, Result } from "./state";

export type Language = "pt-BR" | "ja";
interface Messages {
  back: string;
  language: string;
  title: string;
  subtitle: string;
  badge: string;
  list: string;
  form: string;
  print: string;
  source: string;
  saved: string;
  ready: string;
  empty: string;
  answered: string;
  attention: string;
  search: string;
  all: string;
  groups: string;
  period: string;
  annual: string;
  quarterly: string;
  periodHelp: string;
  metadata: string;
  example: string;
  exampleHelp: string;
  select: string;
  actions: string;
  actionsHelp: string;
  note: string;
  notes: string;
  notesJa: string;
  reviewed: string;
  notesHelp: string;
  sampleHelp: string;
  printIssues: string;
  noMatches: string;
  retry: string;
  unsaved: string;
  conflict: string;
  corrupt: string;
  export: string;
  current: string;
  progress: string;
  previous: string;
  next: string;
  item: string;
  results: Record<Result, string>;
  maintenance: Record<Action, string>;
  fields: Record<keyof HeaderFields, string>;
}
export const messages: Record<Language, Messages> = {
  "pt-BR": {
    back: "Voltar à oficina",
    language: "Idioma",
    title: "Inspeção periódica",
    subtitle:
      "Confira os 100 itens do formulário e experimente o preenchimento.",
    badge: "Prévia do aplicativo",
    list: "Lista de inspeção",
    form: "Ver formulário em japonês",
    print: "Imprimir modelo em japonês",
    source: "Abrir PDF original",
    saved: "Rascunho salvo neste navegador",
    ready: "As alterações serão salvas neste navegador",
    empty: "Sem resposta",
    answered: "Respondidos",
    attention: "A conferir",
    search: "Buscar item ou componente",
    all: "Todos os itens",
    groups: "Grupos de inspeção",
    period: "Mostrar periodicidade",
    annual: "12 meses",
    quarterly: "3 e 12 meses",
    periodHelp:
      "O filtro segue as cores do PDF. Consulte as notas de aplicação; nenhum item é dispensado automaticamente.",
    metadata: "Dados do veículo e da oficina",
    example: "Experimentar dados de exemplo",
    exampleHelp:
      "Preenche somente campos vazios com dados fictícios. As respostas de inspeção continuam sob seu controle.",
    select: "Selecionar",
    actions: "Serviços realizados",
    actionsHelp:
      "Marque os serviços separadamente. Eles entram no formulário quando o item estiver verificado.",
    note: "Nota",
    notes: "Observações em português",
    notesJa: "Texto japonês para impressão",
    reviewed: "Conferi o texto japonês para impressão",
    notesHelp:
      "Se houver observações em português, informe e confira a versão japonesa antes de imprimir.",
    sampleHelp:
      "Modelo para conferência, com a marca japonesa “amostra / não finalizado”. As marcações aparecem nas posições do PDF original.",
    printIssues:
      "Revise os campos antes de imprimir. Confira datas, números, espaço disponível e o texto japonês:",
    noMatches: "Nenhum item encontrado. Altere a busca ou a periodicidade.",
    retry: "Tentar salvar novamente",
    unsaved:
      "Não salvo. Suas alterações continuam nesta tela. Tente salvar novamente ou baixe uma cópia.",
    conflict:
      "Este rascunho mudou em outra aba. Baixe uma cópia das alterações desta tela antes de recarregar.",
    corrupt:
      "Não foi possível abrir o rascunho. Os dados existentes foram preservados. Verifique o armazenamento do navegador antes de continuar.",
    export: "Baixar cópia do rascunho",
    current: "Grupo atual",
    progress: "Progresso do preenchimento",
    previous: "Grupo anterior",
    next: "Próximo grupo",
    item: "Item",
    results: {
      "": "Sem resposta",
      checked: "Verificado",
      attention: "Conferir",
      notApplicable: "Não se aplica",
    },
    maintenance: {
      specific: "Manutenção específica",
      adjust: "Ajuste",
      tighten: "Reaperto",
      replace: "Substituição",
      repair: "Reparo",
      clean: "Limpeza",
      lubricate: "Lubrificação",
    },
    fields: {
      customer: "Nome do usuário do veículo",
      address: "Endereço do usuário",
      registration: "Placa ou chassi",
      makeModel: "Marca e modelo",
      engineModel: "Modelo do motor",
      firstRegistration: "Primeiro registro (ano e mês)",
      odometer: "Quilometragem (km)",
      inspectionDate: "Data da inspeção",
      inspectionMonths: "Inspeção de",
      completionDate: "Data de conclusão dos serviços",
      workshopName: "Nome da oficina",
      workshopAddress: "Endereço da oficina",
      accreditation: "Número de credenciamento",
      inspector: "Responsável pela manutenção",
      co: "CO (%)",
      hc: "HC (ppm)",
    },
  },
  ja: {
    back: "工場画面へ戻る",
    language: "表示言語",
    title: "定期点検",
    subtitle: "原本の100項目を確認し、記入をお試しいただけます。",
    badge: "アプリの試作版",
    list: "点検項目一覧",
    form: "日本語の帳票を確認",
    print: "日本語の見本を印刷",
    source: "原本PDFを開く",
    saved: "このブラウザーに下書き保存済み",
    ready: "変更はこのブラウザーに保存されます",
    empty: "未記入",
    answered: "記入済み",
    attention: "要確認",
    search: "項目・装置を検索",
    all: "全項目",
    groups: "点検する装置",
    period: "点検周期で表示",
    annual: "12か月",
    quarterly: "3・12か月",
    periodHelp:
      "原本の色分けによる表示です。適用条件は注記を確認してください。項目を自動的に省略することはありません。",
    metadata: "車両・事業場情報",
    example: "見本データを入力",
    exampleHelp: "空欄だけに架空の情報を入力します。点検結果は変更しません。",
    select: "選択",
    actions: "実施した整備",
    actionsHelp:
      "整備内容を別途選択してください。「点検済み」にすると帳票に反映されます。",
    note: "注記",
    notes: "備考",
    notesJa: "印刷用の日本語",
    reviewed: "印刷用の日本語を確認しました",
    notesHelp:
      "ポルトガル語の備考がある場合は、印刷前に日本語を入力して確認してください。",
    sampleHelp:
      "「見本・未確定」と表示される確認用の帳票です。記号は原本と同じ位置に反映されます。",
    printIssues:
      "印刷前に次の入力を確認してください。日付・数値・文字数・日本語の確認が必要です：",
    noMatches:
      "該当する項目がありません。検索条件や点検周期を変更してください。",
    retry: "保存を再試行",
    unsaved:
      "未保存です。変更は画面内に保持しています。再試行するか、下書きをダウンロードしてください。",
    conflict:
      "別のタブで下書きが変更されました。再読み込みの前に、この画面の変更をダウンロードしてください。",
    corrupt:
      "下書きを読み込めませんでした。既存データは保持しています。ブラウザーの保存領域を確認してください。",
    export: "下書きをダウンロード",
    current: "表示中の装置",
    progress: "記入状況",
    previous: "前の装置",
    next: "次の装置",
    item: "項目",
    results: {
      "": "未記入",
      checked: "点検済み",
      attention: "要確認",
      notApplicable: "該当なし",
    },
    maintenance: {
      specific: "特定整備",
      adjust: "調整",
      tighten: "締付",
      replace: "交換",
      repair: "修理",
      clean: "清掃",
      lubricate: "給油",
    },
    fields: {
      customer: "使用者氏名又は名称",
      address: "使用者住所",
      registration: "自動車登録番号又は車台番号",
      makeModel: "車名及び型式",
      engineModel: "原動機の型式",
      firstRegistration: "初度登録年月",
      odometer: "総走行距離（km）",
      inspectionDate: "点検年月日",
      inspectionMonths: "点検周期",
      completionDate: "整備完了年月日",
      workshopName: "整備事業場名",
      workshopAddress: "所在地",
      accreditation: "認証番号",
      inspector: "整備管理者氏名",
      co: "CO（％）",
      hc: "HC（ppm）",
    },
  },
};
