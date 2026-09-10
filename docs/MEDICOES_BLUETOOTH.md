# Medições por instrumento — preparação da conexão Bluetooth

Data: 10/09/2026. Autor: auxiliar interno do GPTCodex `measurements_bluetooth`.
Não é Claude Code; revisão de Claude somente poderá ser registrada quando recebida.

O aplicativo possui uma camada de conexão BLE por Web Bluetooth preparada para
perfis de instrumentos revisados. Nenhum perfil de fabricante foi ativado nesta
entrega: ainda falta identificar o modelo que a oficina usará, obter seu protocolo
de integração e verificar o aparelho no tablet. Digitação manual e a demonstração
de medições continuam independentes da conexão física.

## O que as fontes confirmam

- A página oficial da KTC explica que o TRASAS Admin recebe, mostra e registra
  medições dos aparelhos TRASAS via Bluetooth. A publicação oficial na Google Play
  identifica os medidores de pneu GNDA020 e de pastilha GNNA025 entre os modelos
  atendidos pelo aplicativo KTC. Isso comprova a integração com o aplicativo da
  fabricante; não comprova integração com nosso navegador.
  [Suporte GNDA020](https://ktc.jp/support/gnda020),
  [TRASAS Admin oficial](https://play.google.com/store/apps/details?hl=ja&id=jp.ktc.trasasadmin).
- O manual do GNDA020 informa BLE 4.0 e medição em mm. O modelo posterior GNDA020A
  tem outro manual, com pareamento pelas configurações Bluetooth do sistema. Não
  se deve presumir que aparelhos com nomes semelhantes usem o mesmo protocolo.
  [Manual GNDA020](https://ktc.jp/files/pdf/dl_man/gnda020.pdf),
  [Manual GNDA020A](https://ktc.jp/files/pdf/dl_man/gnda020a.pdf).
- Na documentação pública examinada não foram encontrados UUIDs GATT e um
  protocolo de quadros suficiente para implementar o decodificador desses
  instrumentos. Esta é uma conclusão limitada à pesquisa, não a afirmação de que
  tal documentação inexiste. Não foram inventados UUIDs, comandos de inicialização
  ou formatos ASCII como se fossem dados KTC.
- Web Bluetooth exige contexto seguro, autorização por seletor de dispositivos e
  gesto do usuário. A API trabalha com serviços/características BLE; oferecer
  Bluetooth no sistema operacional não garante que um instrumento funcione com
  esse transporte. A documentação Chrome distingue também Bluetooth Classic.
  [Documentação Chrome](https://developer.chrome.com/docs/capabilities/bluetooth).

## Contrato para a interface

Arquivo: `admin-web/src/measurements/bluetooth.ts`.

```ts
getBluetoothAvailability(): "available" | "unsupported" | "insecure";
getConfiguredProfile(): GaugeProfile | undefined;
SUPPORTED_GAUGE_PROFILES: readonly GaugeProfile[]; // vazio nesta entrega

connectGauge(profile, {
  onReading(valueMm, deviceName) {},
  onDisconnect() {},
  onError(code) {},
}, { signal?, timeoutMs? }): Promise<GaugeConnection>;

// GaugeConnection: deviceName, profileId, disconnect()
```

`available` informa somente a presença da API em contexto adequado. Não informa
rádio ligado, autorização concedida nem compatibilidade com a KTC.

O perfil é um módulo de código revisado, não um formulário para mecânicos
digitarem UUIDs. Ele precisa declarar ID, nome, UUID completo de serviço e
característica, limites de bytes do quadro, faixa de medição e função
`decode(DataView): number`. O decodificador deve conferir enquadramento, estado
do aparelho, unidade e ordem dos bytes antes de retornar milímetros. Perfis
inválidos e ausência de perfil bloqueiam o seletor.

`connectGauge` deve ser chamado diretamente no clique/toque do usuário. A chamada
ao seletor acontece antes do primeiro `await`; não há reconexão automática,
varredura em segundo plano nem leitura criada artificialmente. A interface recebe
o valor para conferência antes de registrar a medição e decide a posição/veículo
corretos. Essa camada não altera respostas do checklist nem aprova inspeções.

Erros iniciais rejeitam uma `GaugeBluetoothError`, cuja propriedade `code` pode
ser localizada pela interface. `onError("INVALID_FRAME")` é usado para quadros
recebidos que falham na validação, sem gravar valor. `onDisconnect` dispara uma
vez por sessão estabelecida. O `AbortSignal` cancela uma tentativa e libera uma
sessão estabelecida, útil ao sair da tela. O limite padrão da tentativa é 30 s
(configurável entre 1 e 60 s); não há timeout de inatividade de uma sessão aberta.

Na desconexão, o listener de medições é removido imediatamente; o encerramento de
notificações e do GATT é solicitado mesmo se um deles falhar. Resultados tardios
de seleção/conexão/notificações não reativam uma sessão cancelada. O seletor do
navegador em si não oferece cancelamento programático nesta API: se continuar
visível após cancelamento/timeout, uma seleção tardia é descartada.

## Validação e ativação de um aparelho

Os testes usam exclusivamente um protocolo binário fictício identificado no
arquivo de testes; ele não é exportado para produção. Cobrem ausência de perfil,
gesto, contexto, filtro de serviço, bytes com deslocamento, quadro truncado ou
excessivo, unidade/estado inválidos, valores não finitos/fora da faixa, desconexão,
cancelamento, timeout e resultados tardios. Esse teste de transporte usa objetos
controlados; não substitui medição com ferramenta física.

Validação executada em 10/09/2026: 12 testes do transporte aprovados, ESLint sem
alertas nos dois arquivos e TypeScript estrito focado aprovado. A validação do
aplicativo completo é responsabilidade da integração da rodada.

Para ativar um aparelho, confirmar modelo/firmware e documentação de transporte;
adicionar perfil com testes baseados em amostras publicadas/autorizadas; verificar
no Galaxy Tab Active5 Pro recebido pela oficina, comparando display e valores
capturados, troca de posição, queda de conexão, repetição e unidades. Se o aparelho
enviar dados como teclado ou exigir SDK nativo, implementar o adaptador correto
em vez de rotulá-lo como GATT compatível.

Nenhum instrumento físico, rádio Bluetooth ou tablet foi testado nesta rodada.
