// Portuguese presentation of the supplied PDF's 100 response rows.
// IDs, Japanese item text, periods and note references come from the source JSON.
// These navigation sections do not introduce applicability or exemption rules.
export const sections: { id: string; ja: string; pt: string }[] = [
  { id: "steering", ja: "かじ取り装置", pt: "Direção" },
  { id: "brakes", ja: "制動装置", pt: "Freios" },
  { id: "wheels", ja: "走行装置", pt: "Rodas e pneus" },
  { id: "suspension", ja: "緩衝装置", pt: "Suspensão" },
  { id: "drivetrain", ja: "動力伝達装置", pt: "Transmissão" },
  { id: "electrical", ja: "電気装置", pt: "Sistema elétrico" },
  { id: "engine", ja: "原動機", pt: "Motor" },
  { id: "emissions", ja: "排出ガス等発散防止装置", pt: "Controle de emissões" },
  { id: "equipment", ja: "その他の装置", pt: "Equipamentos auxiliares" },
  { id: "body", ja: "車枠・車体等", pt: "Chassi, carroceria e segurança" },
];

export const itemTranslations: Record<
  string,
  { component: string; label: string; sectionId: string }
> = {
  "pdf-001": {
    component: "Volante",
    label: "Condições de operação",
    sectionId: "steering",
  },
  "pdf-002": {
    component: "Caixa de direção",
    label: "Vazamento de óleo",
    sectionId: "steering",
  },
  "pdf-003": {
    component: "Caixa de direção",
    label: "Folga na fixação",
    sectionId: "steering",
  },
  "pdf-004": {
    component: "Barras e braços de direção",
    label: "Afrouxamento, folgas e danos",
    sectionId: "steering",
  },
  "pdf-005": {
    component: "Barras e braços de direção",
    label: "Trincas e danos nas coifas das articulações esféricas",
    sectionId: "steering",
  },
  "pdf-006": {
    component: "Manga de eixo",
    label: "Folga nas articulações",
    sectionId: "steering",
  },
  "pdf-007": {
    component: "Rodas direcionais",
    label: "Alinhamento das rodas",
    sectionId: "steering",
  },
  "pdf-008": {
    component: "Direção assistida",
    label: "Folga e danos na correia",
    sectionId: "steering",
  },
  "pdf-009": {
    component: "Direção assistida",
    label: "Vazamento e nível de óleo",
    sectionId: "steering",
  },
  "pdf-010": {
    component: "Direção assistida",
    label: "Folga na fixação",
    sectionId: "steering",
  },

  "pdf-011": {
    component: "Pedal do freio",
    label: "Folga livre e distância até o assoalho com o pedal pressionado",
    sectionId: "brakes",
  },
  "pdf-012": {
    component: "Pedal do freio",
    label: "Eficiência da frenagem",
    sectionId: "brakes",
  },
  "pdf-013": {
    component: "Freio de estacionamento",
    label: "Curso de acionamento",
    sectionId: "brakes",
  },
  "pdf-014": {
    component: "Freio de estacionamento",
    label: "Eficiência da frenagem",
    sectionId: "brakes",
  },
  "pdf-015": {
    component: "Mangueiras e tubulações de freio",
    label: "Vazamentos, danos e condições de instalação",
    sectionId: "brakes",
  },
  "pdf-016": {
    component: "Reservatório de fluido de freio",
    label: "Nível de fluido",
    sectionId: "brakes",
  },
  "pdf-017": {
    component: "Cilindro mestre, cilindros de roda e pinças de freio",
    label: "Funcionamento, desgaste e danos",
    sectionId: "brakes",
  },
  "pdf-018": {
    component: "Câmaras de freio",
    label: "Curso da haste",
    sectionId: "brakes",
  },
  "pdf-019": {
    component: "Câmaras de freio",
    label: "Funcionamento",
    sectionId: "brakes",
  },
  "pdf-020": {
    component: "Válvula de freio, válvula de descarga rápida e válvula relé",
    label: "Funcionamento",
    sectionId: "brakes",
  },
  "pdf-021": {
    component: "Servo de freio",
    label: "Obstrução do filtro de ar",
    sectionId: "brakes",
  },
  "pdf-022": {
    component: "Servo de freio",
    label: "Funcionamento",
    sectionId: "brakes",
  },
  "pdf-023": {
    component: "Came do freio",
    label: "Desgaste",
    sectionId: "brakes",
  },
  "pdf-024": {
    component: "Tambores e sapatas de freio",
    label: "Folga entre tambor e lona",
    sectionId: "brakes",
  },
  "pdf-025": {
    component: "Tambores e sapatas de freio",
    label: "Desgaste das partes deslizantes das sapatas e das lonas",
    sectionId: "brakes",
  },
  "pdf-026": {
    component: "Tambores e sapatas de freio",
    label: "Desgaste e danos nos tambores",
    sectionId: "brakes",
  },
  "pdf-027": {
    component: "Espelho do freio",
    label: "Estado do espelho do freio",
    sectionId: "brakes",
  },
  "pdf-028": {
    component: "Discos e pastilhas de freio",
    label: "Folga entre disco e pastilha",
    sectionId: "brakes",
  },
  "pdf-029": {
    component: "Discos e pastilhas de freio",
    label: "Desgaste das pastilhas",
    sectionId: "brakes",
  },
  "pdf-030": {
    component: "Discos e pastilhas de freio",
    label: "Desgaste e danos nos discos",
    sectionId: "brakes",
  },
  "pdf-031": {
    component: "Tambor e lona do freio central",
    label: "Folga na fixação do tambor",
    sectionId: "brakes",
  },
  "pdf-032": {
    component: "Tambor e lona do freio central",
    label: "Folga entre tambor e lona",
    sectionId: "brakes",
  },
  "pdf-033": {
    component: "Tambor e lona do freio central",
    label: "Desgaste da lona",
    sectionId: "brakes",
  },
  "pdf-034": {
    component: "Tambor e lona do freio central",
    label: "Desgaste e danos no tambor",
    sectionId: "brakes",
  },
  "pdf-035": {
    component: "Mecanismo de segurança dupla dos freios",
    label: "Funcionamento",
    sectionId: "brakes",
  },

  "pdf-036": {
    component: "Rodas",
    label: "Estado dos pneus",
    sectionId: "wheels",
  },
  "pdf-037": {
    component: "Rodas",
    label: "Afrouxamento das porcas e dos parafusos das rodas",
    sectionId: "wheels",
  },
  "pdf-038": {
    component: "Rodas",
    label: "Danos nas porcas e nos parafusos das rodas",
    sectionId: "wheels",
  },
  "pdf-039": {
    component: "Rodas",
    label: "Folga nos rolamentos das rodas dianteiras",
    sectionId: "wheels",
  },
  "pdf-040": {
    component: "Rodas",
    label: "Danos nos aros, anéis laterais e discos das rodas",
    sectionId: "wheels",
  },
  "pdf-041": {
    component: "Rodas",
    label: "Folga nos rolamentos das rodas traseiras",
    sectionId: "wheels",
  },

  "pdf-042": {
    component: "Suspensão por feixe de molas",
    label: "Danos nas molas",
    sectionId: "suspension",
  },
  "pdf-043": {
    component: "Suspensão por feixe de molas",
    label: "Afrouxamento, folgas e danos nas fixações e articulações",
    sectionId: "suspension",
  },
  "pdf-044": {
    component: "Suspensão por molas helicoidais",
    label: "Danos nas molas",
    sectionId: "suspension",
  },
  "pdf-045": {
    component: "Suspensão por molas helicoidais",
    label: "Afrouxamento, folgas e danos nas fixações e articulações",
    sectionId: "suspension",
  },
  "pdf-046": {
    component: "Suspensão pneumática",
    label: "Vazamento de ar",
    sectionId: "suspension",
  },
  "pdf-047": {
    component: "Suspensão pneumática",
    label: "Danos nos foles pneumáticos",
    sectionId: "suspension",
  },
  "pdf-048": {
    component: "Suspensão pneumática",
    label: "Afrouxamento e danos nas fixações e articulações",
    sectionId: "suspension",
  },
  "pdf-049": {
    component: "Suspensão pneumática",
    label: "Funcionamento da válvula niveladora",
    sectionId: "suspension",
  },
  "pdf-050": {
    component: "Amortecedores",
    label: "Vazamento de óleo e danos",
    sectionId: "suspension",
  },

  "pdf-051": {
    component: "Embreagem",
    label:
      "Folga livre do pedal e distância até o assoalho com a embreagem desacoplada",
    sectionId: "drivetrain",
  },
  "pdf-052": {
    component: "Embreagem",
    label: "Funcionamento",
    sectionId: "drivetrain",
  },
  "pdf-053": {
    component: "Embreagem",
    label: "Nível de fluido",
    sectionId: "drivetrain",
  },
  "pdf-054": {
    component: "Caixa de câmbio e caixa de transferência",
    label: "Vazamento e nível de óleo",
    sectionId: "drivetrain",
  },
  "pdf-055": {
    component: "Eixo cardã e semieixos",
    label: "Afrouxamento das conexões",
    sectionId: "drivetrain",
  },
  "pdf-056": {
    component: "Eixo cardã e semieixos",
    label: "Trincas e danos nas coifas das juntas universais",
    sectionId: "drivetrain",
  },
  "pdf-057": {
    component: "Eixo cardã e semieixos",
    label: "Folga nas juntas",
    sectionId: "drivetrain",
  },
  "pdf-058": {
    component: "Eixo cardã e semieixos",
    label: "Folga no rolamento central",
    sectionId: "drivetrain",
  },
  "pdf-059": {
    component: "Diferencial",
    label: "Vazamento e nível de óleo",
    sectionId: "drivetrain",
  },

  "pdf-060": {
    component: "Sistema de ignição",
    label: "Estado das velas de ignição (exceto velas de platina e de irídio)",
    sectionId: "electrical",
  },
  "pdf-061": {
    component: "Sistema de ignição",
    label: "Ponto de ignição",
    sectionId: "electrical",
  },
  "pdf-062": {
    component: "Sistema de ignição",
    label: "Estado da tampa do distribuidor",
    sectionId: "electrical",
  },
  "pdf-063": {
    component: "Bateria",
    label: "Condições das conexões dos terminais",
    sectionId: "electrical",
  },
  "pdf-064": {
    component: "Fiação elétrica",
    label: "Afrouxamento e danos nas conexões",
    sectionId: "electrical",
  },

  "pdf-065": {
    component: "Conjunto do motor",
    label: "Estado do elemento do filtro de ar",
    sectionId: "engine",
  },
  "pdf-066": {
    component: "Conjunto do motor",
    label: "Funcionamento em baixa rotação e na aceleração",
    sectionId: "engine",
  },
  "pdf-067": {
    component: "Conjunto do motor",
    label: "Condições dos gases de escape",
    sectionId: "engine",
  },
  "pdf-068": {
    component: "Conjunto do motor",
    label: "Condições de aperto do cabeçote e dos coletores",
    sectionId: "engine",
  },
  "pdf-069": {
    component: "Sistema de lubrificação",
    label: "Vazamento de óleo",
    sectionId: "engine",
  },
  "pdf-070": {
    component: "Sistema de combustível",
    label: "Vazamento de combustível",
    sectionId: "engine",
  },
  "pdf-071": {
    component: "Sistema de arrefecimento",
    label: "Folga e danos na correia do ventilador",
    sectionId: "engine",
  },
  "pdf-072": {
    component: "Sistema de arrefecimento",
    label: "Vazamento de líquido de arrefecimento",
    sectionId: "engine",
  },

  "pdf-073": {
    component: "Sistema de recirculação dos gases do cárter",
    label: "Estado da válvula dosadora",
    sectionId: "emissions",
  },
  "pdf-074": {
    component: "Sistema de recirculação dos gases do cárter",
    label: "Danos nas tubulações",
    sectionId: "emissions",
  },
  "pdf-075": {
    component: "Sistema de controle de vapores de combustível",
    label: "Danos nas tubulações e demais componentes",
    sectionId: "emissions",
  },
  "pdf-076": {
    component: "Sistema de controle de vapores de combustível",
    label: "Obstrução e danos no cânister de carvão ativado",
    sectionId: "emissions",
  },
  "pdf-077": {
    component: "Sistema de controle de vapores de combustível",
    label: "Funcionamento da válvula de retenção",
    sectionId: "emissions",
  },
  "pdf-078": {
    component: "Sistema de controle de monóxido de carbono e outros gases",
    label:
      "Folga na fixação e danos no catalisador e nos demais dispositivos de redução dos gases de escape",
    sectionId: "emissions",
  },
  "pdf-079": {
    component: "Sistema de controle de monóxido de carbono e outros gases",
    label: "Funcionamento do sistema de fornecimento de ar secundário",
    sectionId: "emissions",
  },
  "pdf-080": {
    component: "Sistema de controle de monóxido de carbono e outros gases",
    label: "Funcionamento do sistema de recirculação dos gases de escape",
    sectionId: "emissions",
  },
  "pdf-081": {
    component: "Sistema de controle de monóxido de carbono e outros gases",
    label:
      "Funcionamento do dispositivo de redução das emissões durante a desaceleração",
    sectionId: "emissions",
  },
  "pdf-082": {
    component: "Sistema de controle de monóxido de carbono e outros gases",
    label: "Danos e condições de instalação das tubulações",
    sectionId: "emissions",
  },

  "pdf-083": {
    component:
      "Buzina, limpadores, lavador do para-brisa, desembaçador e fechaduras",
    label: "Funcionamento",
    sectionId: "equipment",
  },
  "pdf-084": {
    component: "Tubo de escape e silencioso",
    label: "Folga na fixação e danos",
    sectionId: "equipment",
  },
  "pdf-085": {
    component: "Tubo de escape e silencioso",
    label: "Funcionamento do silencioso",
    sectionId: "equipment",
  },
  "pdf-086": {
    component: "Compressor de ar",
    label: "Água condensada no reservatório de ar",
    sectionId: "equipment",
  },
  "pdf-087": {
    component: "Compressor de ar",
    label:
      "Funcionamento do compressor, do regulador de pressão e da válvula descarregadora",
    sectionId: "equipment",
  },
  "pdf-088": {
    component: "Sistema de combustível a gás de alta pressão",
    label: "Vazamentos de gás e danos nas tubulações e conexões",
    sectionId: "equipment",
  },
  "pdf-089": {
    component: "Sistema de combustível a gás de alta pressão",
    label: "Afrouxamento e danos na fixação do cilindro de gás",
    sectionId: "equipment",
  },

  "pdf-090": {
    component: "Chassi e carroceria",
    label: "Funcionamento da porta de saída de emergência",
    sectionId: "body",
  },
  "pdf-091": {
    component: "Chassi e carroceria",
    label: "Afrouxamento e danos",
    sectionId: "body",
  },
  "pdf-092": {
    component: "Chassi e carroceria",
    label: "Afrouxamento, folgas e danos no suporte do estepe",
    sectionId: "body",
  },
  "pdf-093": {
    component: "Chassi e carroceria",
    label: "Condições de fixação do estepe",
    sectionId: "body",
  },
  "pdf-094": {
    component: "Chassi e carroceria",
    label: "Afrouxamento e danos na fixação da caixa de ferramentas",
    sectionId: "body",
  },
  "pdf-095": {
    component: "Dispositivo de acoplamento",
    label: "Funcionamento e danos no acoplador",
    sectionId: "body",
  },
  "pdf-096": {
    component: "Dispositivo de acoplamento",
    label: "Desgaste, trincas e danos no gancho de engate",
    sectionId: "body",
  },
  "pdf-097": {
    component: "Bancos",
    label:
      "Estado dos cintos de segurança (somente ônibus e automóveis de passageiros)",
    sectionId: "body",
  },
  "pdf-098": {
    component: "Dispositivo que impede a saída com a porta aberta",
    label: "Funcionamento",
    sectionId: "body",
  },
  "pdf-099": {
    component: "Outros",
    label: "Condições de lubrificação com óleo e graxa nos pontos do chassi",
    sectionId: "body",
  },
  "pdf-100": {
    component: "Outros",
    label:
      "Resultado do diagnóstico a bordo (exceto veículos especiais de grande porte)",
    sectionId: "body",
  },
};

// Source notes are transcribed from the original PDF, including its wording.
// Display these conditions; do not automatically exempt or approve a vehicle.
export const footnotes: Record<string, { ja: string; pt: string }> = {
  "※1": {
    ja: "（※1）印の点検は、自動車検査証の交付を受けた日又は前回の点検を行った日以降の走行距離が３か月当たり２，000ｋｍ以下の自動車については、前回の点検時期に点検を行わなかった場合を除き、行わななくてもよい。",
    pt: "As verificações assinaladas com a nota 1 podem ser dispensadas em veículos que tenham percorrido até 2.000 km por período de 3 meses desde a emissão do certificado de inspeção ou desde a última inspeção realizada. Essa dispensa não se aplica quando a verificação não foi realizada no período de inspeção anterior.",
  },
  "※2": {
    ja: "（※2）印の点検は、車両総重量８トン以上又は乗車定員３０人以上の自動車に限る。",
    pt: "As verificações assinaladas com a nota 2 se aplicam somente a veículos com peso bruto total igual ou superior a 8 toneladas ou lotação de 30 pessoas ou mais.",
  },
  "※3": {
    ja: "（※3）印の点検は、原動機、制動装置、アンチロック・ブレーキシステム及びエアバック（かじ取り装置並びに車枠及び車体に備えるものに限る。）、衝突被害軽減制動制御装置、自動命令型操舵機能及び自動運行装置に係る識別表示（道路運送車両の保安基準に適合しないおそれがあるものとして警報するものに限る。）の点検をもって代えることができる。",
    pt: "A verificação assinalada com a nota 3 pode ser substituída pela inspeção dos indicadores de advertência do motor, do sistema de freios, do sistema antitravamento dos freios (ABS), dos airbags (somente os instalados na direção, no chassi ou na carroceria), do sistema de frenagem para mitigação de colisões, da função de esterçamento comandado automaticamente e do sistema de condução automatizada. São considerados somente os indicadores que alertam para possível desconformidade com os padrões de segurança dos veículos rodoviários.",
  },
};
