# Susumu Vehicle Check — Android V1

Aplicativo Flutter nativo para inspeções da oficina. Nenhum dado demonstrativo é embutido no produto: veículos e versões publicadas dos checklists vêm da API configurada no login.

## Executar e verificar

SDK verificado: Flutter 3.47.2 / Dart 3.13.2, JDK 17, Android SDK 36 e NDK 28.2.13676358. Android mínimo: API 24. No ambiente preparado, execute `. C:\Dev\tools\SUSUMU-env.ps1` antes dos comandos.

```powershell
flutter pub get
dart run build_runner build
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
flutter build apk --debug
```

APK de avaliação: `build/app/outputs/flutter-apk/app-debug.apk`. Este artefato é assinado com a chave de depuração e não é uma distribuição de produção. Release não usa a chave debug: a configuração de assinatura de distribuição deve ser fornecida pelo pipeline autorizado.

O servidor é configurado por sua origem HTTPS, sem `/api/v1` no campo. A API acrescenta esse prefixo internamente. Para um **DEV debug explícito**, `flutter run --debug --dart-define=ALLOW_HTTP_DEV=true` habilita HTTP; o manifest e o código release continuam bloqueando HTTP. Certificados inválidos não são aceitos automaticamente.

`flutter_secure_storage` está fixado em **10.0.0**, cuja versão publicada usa Android compileSdk36 e Tink1.19.0. A versão11 usa compileSdk37, mas a combinação publicada de plugin/AGP procura `android-37` enquanto o pacote oficial instalado é `android-37.0`; nenhuma dependência ou SDK foi adulterada para contornar isso. Tokens ficam no armazenamento protegido do Android; senhas não são persistidas. `image_picker`1.2.3, `mobile_scanner`7.4.0 e Drift2.34.4 estão no lockfile. Atualizações exigem repetir os testes e a compilação.

## Persistência e sincronização

* Drift/SQLite schema1, com tabelas tipadas, `synchronous=FULL` e transações para inspeção/outbox e metadados de foto. `drift_schemas` registra o schema inicial; futuros schemas precisam de migração incremental, nunca apagar/recriar o banco.
* Cada rascunho fixa os snapshots de veículo e template. O texto numérico ainda incompleto fica em `_input` somente local; a API recebe o número validado, sem arredondar medições. Quilometragem é int32 não negativo, medições aceitam até quatro casas decimais.
* As opções `allowedStatuses` de cada item são preservadas na versão fixada e no cache offline. Ausente/null oferece os cinco status legados; uma lista explícita limita as escolhas visíveis. Finalização rejeita status fora da lista e ausência de resposta em item obrigatório. N/A escolhido explicitamente é válido quando permitido pelo template, inclusive em item obrigatório, sem exigir medição numérica. Um status antigo inválido permanece salvo, com aviso para revisão; nunca é convertido automaticamente.
* Autosave inicia em cada alteração. “Salvo no tablet” aparece somente depois do commit. Falha de espaço/SQLite fica visível e impede sair da edição sem nova tentativa. Finalização grava uma cópia e só torna a tela imutável depois do commit.
* Operações ainda nunca tentadas podem ser substituídas pela edição mais recente. Após a primeira tentativa, ID e bytes permanecem imutáveis. Versões encadeiam a partir da versão confirmada mais as operações anteriores pendentes. Payload incompleto permanece na fila sem ser enviado; a correção substitui esse payload antes da primeira tentativa.
* Um único sincronizador serial executa autenticação online, operações e fotos. Backoff de30s até16min, nova tentativa manual e retomada em uso do aplicativo. O Android pode suspender o processo no segundo plano; envio contínuo com app encerrado não é prometido.
* 400/403/404/409/413/415/422 deixam a operação bloqueada e preservada para revisão. O bloqueio é por inspeção: a sequência dessa inspeção para, enquanto outras inspeções e fotos já declaradas continuam. Uma falha de foto é registrada individualmente e não impede as demais. Uma inspeção antiga pode conflitar com quilometragem atualizada por outra inspeção; requer revisão do supervisor.
* A fila oferece **Criar cópia para revisão**: ação explícita com motivo, novo UUID, resposta/fotos copiadas com novas identidades, nova assinatura e vínculo local com a origem. O ID original e o motivo acompanham as notas enviadas; notas longas ficam locais até revisão, sem truncamento. O original selado e a operação tentada nunca são alterados. O operador deve conferir o histórico do servidor antes de finalizar a cópia, pois a origem pode já ter sido recebida. Essa cópia não se apresenta como uma correção aceita pelo servidor.
* A confirmação de cada operação guarda os IDs de fotos efetivamente declarados no servidor. Fotos sem status escolhido aguardam a declaração. “Tudo sincronizado” exige ausência de operações e de fotos pendentes após os uploads.
* Logout remove a sessão/token e reinicia todas as rotas de navegação. Banco e originais permanecem. Partições usam servidor, usuário, empresa e unidade; nova unidade não acessa dados de uma atribuição anterior.
* Home e fila mostram um aviso genérico quando existem registros de outra sessão/servidor no tablet, sem expor proprietário, placa ou detalhes. Não há migração automática entre ambientes.
* A sessão offline permite edição por até72h após login online. Horário máximo observado é persistido para reduzir extensão por retrocesso do relógio. A política de relógio confiável/MDM ainda precisa ser validada no tablet corporativo.
* Histórico do servidor usa páginas explícitas de100 registros (`limit`/`offset`) e o botão **Carregar mais registros**. IDs repetidos são unificados, inclusive com os registros locais. Falha de uma página conserva o cache e permite retentar o mesmo offset. Offline, somente páginas já salvas estão disponíveis; a interface não promete que todo o histórico foi baixado.
* Os detalhes históricos resolvem a versão exata do checklist via `GET /templates/{id}`, guardada em cache por sessão, ID e versão. Exibem nome, rótulos, unidades e data/hora local; uma definição ausente é indicada explicitamente. Um401 no histórico, template ou foto também revoga a sessão e remove suas rotas.

## Fotos e recuperação

Fotos JPEG/PNG de até15MiB são copiadas sem recompressão para armazenamento privado e verificadas por SHA256. Desenho por toque ou S Pen cria outro PNG em resolução original, vinculado ao ID da foto original. Fotos finalizadas não podem ser removidas ou alteradas.

Um manifesto `.json` independente acompanha cada arquivo. Se o processo parar após gravar a imagem e antes de vincular a foto no SQLite, a próxima sessão do proprietário recupera o vínculo uma única vez. `image_picker.retrieveLostData()` recupera o resultado de câmera após destruição da Activity. O journal e o bloqueio da câmera são globais, pois o resultado perdido do plugin também é global: uma captura de A é drenada para os arquivos privados de A antes de permitir captura por B. Nunca se expõe essa captura na interface de B. Caminhos temporários retornados e UUIDs estáveis permitem retentar a preservação após falha de escrita. Formato/tamanho não suportado é preservado em quarentena privada e libera nova captura; falta real de espaço mantém o journal e exige recuperação do armazenamento. Arquivos recuperáveis cujo rascunho já esteja finalizado ficam preservados com erro explícito para revisão.

Se Android remover um temporário da câmera, a recuperação procura primeiro o original determinístico e seu manifesto, verificando tamanho e SHA256. Quando o sistema operacional confirma que a origem não existe e não há original válido, registra um diagnóstico privado do proprietário, avança somente essa entrada e libera novas capturas. Erros de permissão ou I/O não são tratados como ausência; falhas de gravação mantêm o journal. Fotos órfãs/finalizadas são relatadas, enquanto outros anexos válidos continuam sendo recuperados.

## Testes com API real

O runner abaixo **grava dados sintéticos** somente em localhost e falha se as variáveis estiverem ausentes. Não faz parte do comando de testes unitários padrão. Ele exercita login/bootstrap, SQLite, rascunho, foto original/anotação, finalização, replay idempotente e histórico usando a implementação Dart real.

Configure `SUSUMU_TEST_API`, `SUSUMU_TEST_USER` e `SUSUMU_TEST_PASSWORD` no ambiente do processo de teste sem versionar ou registrar seus valores e execute:

```powershell
flutter test test/live_api_contract.dart --dart-define=ALLOW_HTTP_DEV=true
```

## Aceitação no Galaxy Tab Active5 Pro

Testes unitários/widgets e APK não substituem teste físico. Confirmar câmera/permissões, destruição de Activity, reinicialização/queda de energia, restauração de token no Keystore, perda de rede durante upload, espaço insuficiente, orientação/reescala, luvas, S Pen e rejeição de palma. O editor aceita toque/stylus e traços; reconhecimento de caligrafia e sensibilidade à pressão não são recursos V1.

Assinaturas são PNGs separados, sem item de checklist fictício, declarados por `signaturePhotoId`. O pad impede assinatura em branco e permite limpar antes de salvar. `requiresSignature` do template exige essa declaração antes da finalização, inclusive offline; envio pendente permanece explícito até verificação do servidor. A assinatura salva fica imutável; uma correção recebe nova assinatura. Templates iniciais mantêm a política opcional por padrão.

Validar também a instalação gerenciada/Knox, política de bloqueio e relógio, certificados HTTPS, distribuição assinada e atualização preservando o banco. Não desinstalar/limpar dados de um tablet com trabalho pendente. Conflitos são expostos para decisão do supervisor; V1 não inclui uma ferramenta automática para fundir ou descartar operações.

Referências oficiais consultadas: [Drift](https://drift.simonbinder.eu/setup/), [image_picker](https://pub.dev/packages/image_picker), [mobile_scanner](https://pub.dev/packages/mobile_scanner), [flutter_secure_storage](https://pub.dev/packages/flutter_secure_storage/versions/10.0.0), [configuração Android](https://developer.android.com/build).
