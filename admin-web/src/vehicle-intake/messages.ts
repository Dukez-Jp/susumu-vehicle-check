import type { VehicleCaptureFields } from "./capture";

export type IntakeLanguage = "pt-BR" | "ja";

const pt = {
  title: "Dados do caminhão",
  subtitle: "Digite os dados ou importe o arquivo do certificado eletrônico.",
  back: "Voltar à oficina",
  language: "Idioma",
  preview: "Coleta local · Prévia",
  scope:
    "As coletas ficam neste navegador. O vínculo ao cadastro da frota e às inspeções será integrado na próxima etapa.",
  manual: "Digitar manualmente",
  file: "Importar arquivo",
  nfc: "NFC pelo aplicativo",
  manualHelp:
    "Preencha os campos disponíveis. Placa e chassi são obrigatórios. A digitação funciona sem leitor NFC e sem internet.",
  fileHelp:
    "No aplicativo oficial de consulta do certificado, exporte o JSON e selecione o arquivo aqui. A exportação no aplicativo exige internet.",
  choose: "Selecionar JSON do certificado",
  loading: "Lendo arquivo…",
  nfcTitle: "Ler o certificado no tablet",
  nfcStatus: "Leitura pelo aplicativo Android",
  nfcHelp:
    "Use no tablet o aplicativo oficial de consulta do certificado, instalado pela Google Play. Após a leitura, exporte o JSON e importe o arquivo nesta tela.",
  steps: [
    "Abra no tablet o aplicativo oficial instalado pela Google Play.",
    "Siga as instruções do aplicativo para informar o código do certificado e aproximar o chip.",
    "Exporte o JSON e use a opção Importar arquivo nesta tela.",
  ],
  officialApp: "Orientações do aplicativo oficial",
  nfcNote:
    "A leitura reúne dados do veículo. Os itens da inspeção mecânica continuam sendo preenchidos pelo mecânico.",
  formTitle: "Confira os dados",
  optional: "Campos sem asterisco são opcionais.",
  firstHelp: "Ano e mês (AAAA-MM).",
  validHelp: "Data (AAAA-MM-DD).",
  odoHelp: "Quilometragem atual observada, digitada manualmente.",
  sourceManual: "Origem: digitação manual",
  sourceFile: "Origem: arquivo oficial importado",
  original: "Valores originais do arquivo",
  review: "Conferi placa, chassi e os demais dados preenchidos.",
  save: "Salvar coleta conferida",
  fresh: "Nova coleta",
  saved: "Coleta salva neste navegador.",
  duplicate: "Esta coleta já estava salva. Nenhuma cópia foi criada.",
  savedTitle: "Coletas salvas",
  none: "Nenhuma coleta salva ainda.",
  open: "Abrir coleta",
  collectedAt: "Coletado em",
  method: "Origem",
  manualShort: "Manual",
  fileShort: "Arquivo oficial",
  pending: "Arquivo pronto para conferência",
  replace: "Usar os dados deste arquivo",
  cancel: "Cancelar",
  keep: "Continuar preenchendo",
  discard: "Descartar edição e limpar",
  discardQuestion:
    "Existem campos ainda não salvos. Deseja limpar esta edição?",
  unsaved: "Alterações ainda não salvas",
  reviewRequired: "Confira os dados e marque a confirmação antes de salvar.",
  issueIntro: "Confira os campos indicados antes de salvar.",
  warningIntro: "Alguns valores do arquivo precisam de conferência:",
  fieldLabels: {
    plate: "Placa",
    chassis: "Chassi",
    manufacturer: "Fabricante / marca",
    model: "Modelo",
    engineModel: "Modelo do motor",
    firstRegistration: "Primeiro registro",
    validUntil: "Validade da inspeção veicular",
    grossWeightKg: "Peso bruto total (kg)",
    internalNumber: "Número interno da frota",
    odometerKm: "Quilometragem atual (km)",
  } satisfies Record<keyof VehicleCaptureFields, string>,
  errors: {
    file_too_large: "O arquivo deve ter até 1 MB.",
    invalid_json:
      "Não foi possível ler o JSON. Selecione o arquivo exportado pelo aplicativo oficial.",
    invalid_shape: "O arquivo não tem a estrutura de certificado esperada.",
    unsupported_version: "Esta versão do arquivo ainda não é suportada.",
    invalid_field_type: "O arquivo contém campos em formato inesperado.",
    unsupported_vehicle_type:
      "Esta categoria de arquivo ainda não é suportada.",
    required: "Preencha este campo.",
    too_long: "O valor ultrapassa o tamanho permitido.",
    invalid_date: "Informe uma data válida no formato indicado.",
    invalid_number: "Informe um número inteiro válido.",
    INVALID_CAPTURE: "Confira os dados preenchidos.",
    CORRUPT_STORAGE:
      "As coletas locais não puderam ser lidas. Os dados existentes foram preservados; solicite recuperação.",
    STORAGE_CONFLICT:
      "Outra aba gravou dados. Esta edição continua na tela. Reabra as coletas em uma única aba após preservar os campos desta edição.",
    STORAGE_READ_FAILED: "Não foi possível acessar as coletas neste navegador.",
    STORAGE_WRITE_FAILED:
      "Não foi possível salvar. Os campos continuam na tela; tente novamente.",
    STORAGE_QUOTA_EXCEEDED:
      "O navegador está sem espaço. A coleta não foi salva; mantenha esta tela aberta.",
    CAPTURE_LIMIT: "O limite de coletas desta prévia foi atingido.",
    STORAGE_TOO_LARGE: "O armazenamento desta prévia atingiu o limite.",
    UUID_UNAVAILABLE:
      "Abra a demonstração pelo endereço local seguro para salvar.",
    unknown:
      "Não foi possível concluir. Os dados preenchidos continuam na tela.",
  } as Record<string, string>,
  warnings: {
    invalid_first_registration:
      "Primeiro registro: confira o valor original e informe ano e mês, se disponíveis.",
    invalid_valid_until: "Validade: confira a data no documento original.",
    complex_gross_weight:
      "Peso bruto total: o arquivo contém mais de um valor ou observação; confira o texto original.",
  } as Record<string, string>,
};

const ja: typeof pt = {
  title: "車両情報の収集",
  subtitle: "手入力または電子車検証のファイルから車両情報を取り込みます。",
  back: "作業画面へ戻る",
  language: "表示言語",
  preview: "端末内保存・プレビュー",
  scope:
    "収集データはこのブラウザーに保存されます。車両台帳・点検記録との連携は次の段階で実装します。",
  manual: "手入力",
  file: "ファイル取込",
  nfc: "公式アプリでNFC読取",
  manualHelp:
    "分かる項目を入力してください。登録番号と車台番号は必須です。手入力はNFCリーダーやインターネット接続なしで利用できます。",
  fileHelp:
    "車検証閲覧アプリでJSONを出力し、ここで選択してください。アプリでのファイル出力にはインターネット接続が必要です。",
  choose: "車検証のJSONファイルを選択",
  loading: "ファイルを読み込み中…",
  nfcTitle: "タブレットで車検証を読み取る",
  nfcStatus: "Androidアプリで読み取り",
  nfcHelp:
    "Google Playからインストールした車検証閲覧アプリをタブレットで使用してください。読み取り後にJSONを出力し、この画面で取り込みます。",
  steps: [
    "タブレットでGoogle Playからインストールした車検証閲覧アプリを開きます。",
    "アプリの案内に従い、セキュリティコードを入力してICタグに端末を近づけます。",
    "JSONを出力し、この画面の「ファイル取込」で選択します。",
  ],
  officialApp: "車検証閲覧アプリの公式案内",
  nfcNote:
    "読み取りで取得するのは車両情報です。整備士による点検項目の記入は引き続き必要です。",
  formTitle: "車両情報の確認",
  optional: "＊印以外の項目は任意です。",
  firstHelp: "西暦の年月（YYYY-MM）。",
  validHelp: "西暦の日付（YYYY-MM-DD）。",
  odoHelp: "現在の走行距離を確認し、手入力してください。",
  sourceManual: "取得方法：手入力",
  sourceFile: "取得方法：公式ファイル取込",
  original: "ファイルの元の値",
  review: "登録番号・車台番号および入力した情報を確認しました。",
  save: "確認済みデータを保存",
  fresh: "新規収集",
  saved: "このブラウザーに保存しました。",
  duplicate: "同じデータが保存済みです。重複保存は行いませんでした。",
  savedTitle: "保存済みの収集データ",
  none: "保存済みデータはありません。",
  open: "収集データを開く",
  collectedAt: "取得日時",
  method: "取得方法",
  manualShort: "手入力",
  fileShort: "公式ファイル",
  pending: "確認するファイルを読み込みました",
  replace: "このファイルの値を使用",
  cancel: "キャンセル",
  keep: "入力を続ける",
  discard: "未保存の入力を破棄",
  discardQuestion: "未保存の入力があります。入力を消去しますか？",
  unsaved: "未保存の変更があります",
  reviewRequired: "情報を確認し、確認チェックを付けてから保存してください。",
  issueIntro: "保存する前に表示された項目を確認してください。",
  warningIntro: "ファイル内の次の値を確認してください。",
  fieldLabels: {
    plate: "自動車登録番号",
    chassis: "車台番号",
    manufacturer: "車名",
    model: "型式",
    engineModel: "原動機の型式",
    firstRegistration: "初度登録年月・初度検査年月",
    validUntil: "有効期間の満了する日",
    grossWeightKg: "車両総重量（kg）",
    internalNumber: "社内車両番号",
    odometerKm: "現在の走行距離（km）",
  },
  errors: {
    file_too_large: "1 MB以下のファイルを選択してください。",
    invalid_json:
      "JSONを読み取れません。車検証閲覧アプリが出力したファイルを選択してください。",
    invalid_shape: "車検証ファイルの形式が一致しません。",
    unsupported_version: "このファイルのバージョンにはまだ対応していません。",
    invalid_field_type: "ファイル内の項目形式が一致しません。",
    unsupported_vehicle_type:
      "このファイルの車両区分にはまだ対応していません。",
    required: "入力してください。",
    too_long: "入力が長すぎます。",
    invalid_date: "指定の形式で有効な日付を入力してください。",
    invalid_number: "有効な整数を入力してください。",
    INVALID_CAPTURE: "入力内容を確認してください。",
    CORRUPT_STORAGE:
      "端末内のデータを読み取れませんでした。既存データは保持しています。復旧を依頼してください。",
    STORAGE_CONFLICT:
      "別のタブで保存が行われました。この画面の入力は保持しています。入力内容を控えてから、1つのタブで開き直してください。",
    STORAGE_READ_FAILED: "このブラウザーの保存データにアクセスできません。",
    STORAGE_WRITE_FAILED:
      "保存できませんでした。入力は画面に保持しています。再試行してください。",
    STORAGE_QUOTA_EXCEEDED:
      "ブラウザーの保存容量が不足しています。未保存のため、この画面を開いたままにしてください。",
    CAPTURE_LIMIT: "プレビューの保存件数上限に達しました。",
    STORAGE_TOO_LARGE: "プレビューの保存容量上限に達しました。",
    UUID_UNAVAILABLE: "保存するには指定のローカルアドレスで開いてください。",
    unknown: "処理を完了できませんでした。入力内容は画面に保持しています。",
  },
  warnings: {
    invalid_first_registration:
      "初度登録・検査年月：元の値を確認し、分かる場合は西暦の年月を入力してください。",
    invalid_valid_until: "有効期間：元の車検証の日付を確認してください。",
    complex_gross_weight:
      "車両総重量：複数の値または注記があります。元の値を確認してください。",
  },
};

export const messages = { "pt-BR": pt, ja };
