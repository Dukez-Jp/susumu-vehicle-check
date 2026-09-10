import type { Language } from "./language";

/**
 * Every word the workshop screen shows, in one language per interface. The
 * Japanese side is the default because the workshop is in Japan; the Portuguese
 * side exists so a Brazilian mechanic reads the same screens in his own
 * language. Both drive exactly the same records.
 */
const pt = {
  // Falha de leitura dos dados locais
  dataPreserved: "Dados preservados",
  readFailure:
    "Os dados locais não puderam ser lidos. Eles foram preservados. Use outro perfil do Chrome para uma demonstração vazia ou solicite a recuperação.",
  conflictError:
    "Outra gravação foi detectada em outra aba. Esta edição não foi salva. Exporte sua cópia antes de recarregar e use uma única aba.",
  unsavedError:
    "Não salvo. O navegador não confirmou a gravação. Mantenha esta página aberta e tente salvar novamente.",
  photoLimit:
    "Limite de fotos desta demonstração atingido. A nova imagem não foi adicionada; o rascunho foi preservado. Escolha um arquivo menor.",
  photoTypeSize:
    "Escolha uma foto JPG ou PNG de até 1 MB para esta demonstração.",
  photoReadFail: "Não foi possível ler a foto.",
  photoInvalid: "A imagem está inválida ou não pode ser aberta.",
  draftNotFound: "Rascunho não encontrado.",
  odometerRequired: "Informe a quilometragem observada.",

  // Barra lateral
  workshopName: "Oficina de teste",
  workshopSub: "点検 · Inspeção de veículos",
  navMain: "Navegação principal",
  navMeasurements: "Medições de pneus e freios",
  navPdf: "Tenken do PDF · 100 itens",
  navCapture: "Coletar dados do caminhão",
  navHome: "Minha oficina",
  navQueue: "Fila de envio",
  navHistory: "Histórico",
  operatorName: "Operador de teste",
  sessionLabel: "Sessão demonstrativa",
  avatar: "OT",

  // Barra superior
  breadcrumbShop: "Oficina",
  breadcrumbTenken: "Tenken",
  demoTag: "Demonstração local",
  online: "Rede de teste",
  offline: "Sem rede (simulado)",
  noticeOnline:
    "Rede de teste reativada. Use Simular envio para visualizar a fila.",
  noticeOffline:
    "Modo sem rede de teste ativado. Continue preenchendo normalmente.",
  offlineSyncNotice:
    "Modo sem rede de teste: os registros continuam neste navegador.",
  syncDone: "Envio simulado concluído. Nenhum dado foi enviado a um servidor.",

  // Avisos
  retrySave: "Tentar salvar novamente",
  exportMemory: "Exportar cópia em memória",
  closeWarning: "Fechar aviso",
  closeInfo: "Fechar informação",
  closeWindow: "Fechar janela",

  // Página inicial
  homeTitle: "Vamos começar o Tenken?",
  homeSubtitle: "Selecione o veículo e registre cada ponto da inspeção.",
  pilotLabel: "Piloto · 1 tablet",
  measureCardTitle: "Medições, roda por roda",
  measureCardText:
    "Registre pneus, pastilhas e lonas, confira o histórico e abra a ficha de inspeção.",
  measureCardButton: "Experimentar as medições",
  pdfCardTitle: "Seu formulário, dentro do aplicativo",
  pdfCardText:
    "100 itens do PDF, telas em português e japonês e prévia da impressão original.",
  pdfCardButton: "Abrir modelo de 100 itens",
  benchLabel: "Sua bancada de inspeção",
  benchTitleLine1: "Um veículo por vez.",
  benchTitleLine2: "Cada detalhe registrado.",
  benchText:
    "Teste o fluxo com o mouse. Você pode parar e retomar o rascunho neste Chrome.",
  statInProgress: "em andamento",
  statFinalized: "finalizadas",
  statQueue: "na fila de teste",
  resumeTitle: "Continue de onde parou",
  resumePrefix: "Continuar",
  itemsWord: "itens",
  vehiclesTitle: "Veículos disponíveis",
  vehiclesSubtitle: "Cadastros fictícios para explorar a demonstração",
  searchVehicle: "Pesquisar veículo",
  searchPlaceholder: "Número ou placa",
  testDataPill: "Dados de teste",
  lastReading: "Última leitura",
  startInspection: "Iniciar inspeção",
  inspectPrefix: "Inspecionar",
  noVehicles: "Nenhum veículo encontrado. Tente o número 714.",
  footnote:
    "Ambiente demonstrativo com dados fictícios. O checklist precisa ser validado pela oficina antes do uso real.",
  truckAlt: "Ilustração de caminhão da frota de teste",

  // Confirmação do veículo
  backToVehicles: "Voltar aos veículos",
  setupTitle: "Confirme o veículo",
  setupSubtitle: "Confira a identificação antes de iniciar o registro.",
  vehicleWord: "Veículo",
  syntheticPill: "Cadastro sintético",
  newInspection: "Nova inspeção",
  operatorField: "Operador de teste",
  odometerField: "Quilometragem observada (km)",
  odometerHelp:
    "Leitura inferior à cadastrada exige conferência. Não invente uma quilometragem.",
  templateTitle: "Tenken demonstrativo · versão 1",
  templateInfo: "12 itens · 4 seções · assinatura de teste",
  startTenken: "Iniciar Tenken",

  // Checklist
  backToShop: "Voltar à oficina",
  unsavedLabel: "Alterações não salvas",
  savedLabel: "Salvo neste navegador",
  draftVersion: "Rascunho · versão 1",
  answeredWord: "respondidos",
  ofWord: "de",
  itemWord: "Item",
  conditionLegend: "Qual é a condição deste item?",
  criticalTitle: "Comunique a ocorrência ao responsável.",
  criticalText: "Finalizar a inspeção não libera o veículo para circular.",
  measurementLabel: "Medição",
  rangePrefix: "Faixa de entrada de teste:",
  rangeSuffix: "Não é critério de aprovação mecânica.",
  toWord: "a",
  notesLabel: "Observação do item",
  notesPlaceholder: "Descreva o que você observou…",
  evidence: "Evidências",
  evidenceText: "Adicione uma foto do computador e anote com o mouse.",
  readingPhoto: "Lendo foto…",
  addPhoto: "Adicionar foto",
  useTestImage: "Usar imagem de teste",
  testPhotoName: "Pneu — imagem sintética de teste",
  originalKept: "Original preservado",
  annotatedCopy: "Cópia anotada",
  annotate: "Anotar cópia",
  previous: "Anterior",
  nextItem: "Próximo item",
  reviewInspection: "Revisar inspeção",
  allItemsNeedAnswer: "Todos os itens precisam de uma resposta explícita.",

  // Revisão
  backToChecklist: "Voltar ao checklist",
  occurrences: "ocorrências",
  itemsAnswered: "itens respondidos",
  summaryTitle: "Resumo do Tenken",
  signatureTitle: "Assinatura de teste",
  signatureHelp:
    "Exigida neste exemplo. A regra operacional será definida pela oficina.",
  signatureSavedAlt: "Assinatura de teste salva",
  redoSignature: "Refazer assinatura",
  drawSignature: "Desenhar assinatura com o mouse",
  finishTitle: "Encerrar o registro",
  finishText:
    "Finalizar não libera o veículo. O registro fica somente para leitura.",
  criticalReview: "Há item crítico. Comunique ao responsável da oficina.",
  pendingTitle: "Pendências para finalizar",
  readyToFinish: "Registro pronto para finalizar.",
  finishButton: "Finalizar registro",
  sendSeparate:
    "O envio é uma etapa separada. Nesta demonstração ele é apenas simulado.",
  finalizedNotice:
    "Registro finalizado neste navegador. Envio ao escritório ainda não simulado.",

  // Histórico e fila
  historyTitle: "Histórico de inspeções",
  queueTitle: "Fila de envio",
  historySubtitle: "Registros finalizados nesta demonstração.",
  queueSubtitle:
    "Visualize como os registros aguardam o envio ao escritório.",
  simulateSend: "Simular envio",
  queueInfo:
    "Simulação: nenhum dado é enviado ao servidor. O botão de rede não desliga o Wi-Fi do PC.",
  historyInfo:
    "Os dados ficam apenas neste perfil e endereço do Chrome. Limpar dados do navegador remove a demonstração.",
  noQueue: "Nenhum envio pendente",
  noFinalized: "Nenhuma inspeção finalizada",
  emptyHint: "Conclua um Tenken para ver o registro aqui.",
  goToShop: "Ir para minha oficina",
  sentPill: "Envio simulado",
  pendingPill: "Pendente de simulação",
  exportDemo: "Exportar dados da demonstração (JSON)",

  // Relatório
  finalizedPill: "Registro finalizado",
  reportPrefix: "Tenken do veículo",
  printReport: "Imprimir relatório",
  localDemo: "Demonstração local",
  sentSim: "Envio simulado, sem servidor.",
  pendingSim: "Envio de teste pendente.",
  notReleased: "Finalizar não libera o veículo.",
  identifier: "Identificador",
  seeQueue: "Ver fila de envio",
  exportJson: "Exportar dados (JSON)",

  // Janelas
  viewPhoto: "Visualizar foto",
  annotatePhoto: "Anotar cópia da foto",
  originalPhoto: "Foto original",
  annotationPrefix: "Anotação de",

  // Rodapé
  footerBrand: "ススム · Vehicle Check",
  footerText: "Protótipo para avaliação de fluxo no Chrome · dados fictícios",

  // Lista de resultados
  noAnswer: "Sem resposta",
  notInformed: "Não informada",
  originalWord: "Original",
};

const ja: typeof pt = {
  dataPreserved: "データは保持しています",
  readFailure:
    "この端末のデータを読み込めませんでした。データはそのまま保持しています。空の状態で試す場合は別のChromeプロファイルを使うか、復旧を依頼してください。",
  conflictError:
    "別のタブでの保存が検出されました。この編集は保存していません。再読み込みの前にコピーを書き出し、タブは一つだけ使用してください。",
  unsavedError:
    "保存できていません。ブラウザーが書き込みを確認しませんでした。このページを開いたまま、もう一度保存してください。",
  photoLimit:
    "この見本で扱える写真の上限に達しました。新しい画像は追加していません。下書きは保持しています。より小さいファイルを選んでください。",
  photoTypeSize:
    "この見本では、1MBまでのJPGまたはPNGの写真を選んでください。",
  photoReadFail: "写真を読み込めませんでした。",
  photoInvalid: "画像が壊れているか、開くことができません。",
  draftNotFound: "下書きが見つかりません。",
  odometerRequired: "確認した走行距離を入力してください。",

  workshopName: "見本の工場",
  workshopSub: "点検 · 車両点検",
  navMain: "主なメニュー",
  navMeasurements: "タイヤ・ブレーキの測定",
  navPdf: "PDFの点検表 · 100項目",
  navCapture: "車両情報の取り込み",
  navHome: "工場画面",
  navQueue: "送信待ち",
  navHistory: "履歴",
  operatorName: "見本担当者",
  sessionLabel: "見本セッション",
  avatar: "見本",

  breadcrumbShop: "工場",
  breadcrumbTenken: "点検",
  demoTag: "この端末だけの見本",
  online: "見本の通信",
  offline: "通信なし（模擬）",
  noticeOnline:
    "見本の通信を再開しました。「送信を模擬」で送信待ちの様子を確認できます。",
  noticeOffline:
    "通信なしの見本モードにしました。そのまま入力を続けられます。",
  offlineSyncNotice:
    "通信なしの見本モードです。記録はこのブラウザーに残ります。",
  syncDone:
    "送信の模擬が完了しました。サーバーへは何も送信していません。",

  retrySave: "もう一度保存する",
  exportMemory: "画面上のコピーを書き出す",
  closeWarning: "警告を閉じる",
  closeInfo: "お知らせを閉じる",
  closeWindow: "ウィンドウを閉じる",

  homeTitle: "点検を始めましょう",
  homeSubtitle: "車両を選び、点検の各項目を記録してください。",
  pilotLabel: "試行 · タブレット1台",
  measureCardTitle: "一輪ずつの測定",
  measureCardText:
    "タイヤ、パッド、ライニングを記録し、履歴を確認して点検表を開きます。",
  measureCardButton: "測定を試す",
  pdfCardTitle: "紙の様式を、そのまま画面で",
  pdfCardText:
    "PDFの100項目、日本語とポルトガル語の画面、原本どおりの印刷プレビュー。",
  pdfCardButton: "100項目の点検表を開く",
  benchLabel: "点検の作業台",
  benchTitleLine1: "一台ずつ、確実に。",
  benchTitleLine2: "すべての所見を記録。",
  benchText:
    "マウスで操作を試せます。途中でやめても、このChromeで下書きを再開できます。",
  statInProgress: "作業中",
  statFinalized: "確定済",
  statQueue: "送信待ち",
  resumeTitle: "途中から再開",
  resumePrefix: "続ける",
  itemsWord: "項目",
  vehiclesTitle: "選べる車両",
  vehiclesSubtitle: "見本を試すための架空の登録です",
  searchVehicle: "車両を検索",
  searchPlaceholder: "車番または登録番号",
  testDataPill: "見本データ",
  lastReading: "前回の走行距離",
  startInspection: "点検を開始",
  inspectPrefix: "点検する車両",
  noVehicles: "該当する車両がありません。車番714をお試しください。",
  footnote:
    "架空のデータによる見本環境です。実際に使用する前に、点検項目を工場で確認する必要があります。",
  truckAlt: "見本車両のイラスト",

  backToVehicles: "車両一覧へ戻る",
  setupTitle: "車両の確認",
  setupSubtitle: "記録を始める前に、車両の識別情報を確認してください。",
  vehicleWord: "車両",
  syntheticPill: "架空の登録",
  newInspection: "新しい点検",
  operatorField: "点検担当者",
  odometerField: "確認した走行距離（km）",
  odometerHelp:
    "登録より小さい値は確認が必要です。走行距離を推測で入力しないでください。",
  templateTitle: "見本の点検表 · 第1版",
  templateInfo: "12項目 · 4区分 · 見本の署名",
  startTenken: "点検を開始",

  backToShop: "工場画面へ戻る",
  unsavedLabel: "未保存の変更があります",
  savedLabel: "このブラウザーに保存済み",
  draftVersion: "下書き · 第1版",
  answeredWord: "項目に回答",
  ofWord: "／",
  itemWord: "項目",
  conditionLegend: "この項目の状態はどれですか。",
  criticalTitle: "責任者に報告してください。",
  criticalText: "点検を確定しても、車両の運行可否は判断されません。",
  measurementLabel: "測定値",
  rangePrefix: "見本の入力範囲：",
  rangeSuffix: "良否の判定基準ではありません。",
  toWord: "〜",
  notesLabel: "この項目の所見",
  notesPlaceholder: "確認した内容を記入してください…",
  evidence: "記録写真",
  evidenceText: "パソコンから写真を追加し、マウスで書き込めます。",
  readingPhoto: "写真を読み込み中…",
  addPhoto: "写真を追加",
  useTestImage: "見本の画像を使う",
  testPhotoName: "タイヤ — 見本の合成画像",
  originalKept: "原本を保持",
  annotatedCopy: "書き込み済みの複製",
  annotate: "複製に書き込む",
  previous: "前の項目",
  nextItem: "次の項目",
  reviewInspection: "点検内容を確認",
  allItemsNeedAnswer: "すべての項目に明確な回答が必要です。",

  backToChecklist: "点検項目へ戻る",
  occurrences: "件の指摘",
  itemsAnswered: "項目に回答",
  summaryTitle: "点検内容のまとめ",
  signatureTitle: "見本の署名",
  signatureHelp:
    "この例では必須です。実際の運用規則は工場で定めます。",
  signatureSavedAlt: "保存された見本の署名",
  redoSignature: "署名をやり直す",
  drawSignature: "マウスで署名する",
  finishTitle: "記録を確定する",
  finishText:
    "確定しても運行可否は判断されません。記録は読み取り専用になります。",
  criticalReview: "重大な項目があります。工場の責任者に報告してください。",
  pendingTitle: "確定前に必要な対応",
  readyToFinish: "確定できる状態です。",
  finishButton: "記録を確定",
  sendSeparate: "送信は別の作業です。この見本では模擬のみ行います。",
  finalizedNotice:
    "このブラウザーで記録を確定しました。事務所への送信はまだ模擬していません。",

  historyTitle: "点検の履歴",
  queueTitle: "送信待ち",
  historySubtitle: "この見本で確定した記録です。",
  queueSubtitle: "事務所への送信を待つ記録の様子を確認できます。",
  simulateSend: "送信を模擬",
  queueInfo:
    "模擬です。サーバーへは何も送信しません。通信のボタンはパソコンのWi-Fiを切りません。",
  historyInfo:
    "データはこのChromeのプロファイルとアドレスにのみ保存されます。閲覧データを削除すると見本も消えます。",
  noQueue: "送信待ちはありません",
  noFinalized: "確定した点検はありません",
  emptyHint: "点検を完了すると、ここに記録が表示されます。",
  goToShop: "工場画面へ移動",
  sentPill: "送信を模擬済み",
  pendingPill: "模擬待ち",
  exportDemo: "見本データを書き出す（JSON）",

  finalizedPill: "記録は確定済み",
  reportPrefix: "点検記録 · 車両",
  printReport: "記録を印刷",
  localDemo: "この端末だけの見本",
  sentSim: "送信を模擬しました。サーバーはありません。",
  pendingSim: "見本の送信が未了です。",
  notReleased: "確定しても運行可否は判断されません。",
  identifier: "記録識別子",
  seeQueue: "送信待ちを見る",
  exportJson: "データを書き出す（JSON）",

  viewPhoto: "写真を表示",
  annotatePhoto: "写真の複製に書き込む",
  originalPhoto: "原本の写真",
  annotationPrefix: "書き込み：",

  footerBrand: "ススム · Vehicle Check",
  footerText: "Chromeで操作の流れを確認するための試作 · 架空のデータ",

  noAnswer: "未回答",
  notInformed: "未記入",
  originalWord: "原本",
};

export const demoMessages: Record<Language, typeof pt> = { "pt-BR": pt, ja };

/** Numbers and dates follow the language on screen, not the browser locale. */
export const localeOf: Record<Language, string> = {
  "pt-BR": "pt-BR",
  ja: "ja-JP",
};
