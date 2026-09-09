# Entrega técnica V1 — SUSUMU VEHICLE CHECK

Snapshot de validação local em2026-09-09, antes da publicação. **V1 implementada para avaliação DEV; aceite operacional no Galaxy e implantação de produção permanecem pendentes.** A versão contém aplicativo Android, API, painel, cadastros, checklist configurável/versionado, fotos/assinatura, offline/sync, histórico, auditoria, relatórios e ferramentas de operação.

## Validação observada

| Verificação | Resultado |
|---|---|
| Backend combinado |316 aprovados,0 falhas,0 pulados;8 casos reais PostgreSQL18 incluídos. Release sem avisos/erros. |
| Schema |4 migrations; criação do zero e atualização/backfill conferidos no PostgreSQL; modelo EF sem alterações pendentes. |
| Android |63 testes aprovados, análise e formatação limpas; APK debug compilado. |
| Painel |47 testes em11 arquivos aprovados; lint, TypeScript, formatação e build de produção aprovados. |
| Infraestrutura |7 testes Python, sintaxe PowerShell/Bash e verificações Windows de propriedade de processo/ACL aprovados. |
| HTTP real |20 cenários de `tests/integration/api-smoke.mjs` aprovados sobre API/PostgreSQL locais. |
| Flutter/Drift → API/PostgreSQL |1 teste real de editor, persistência, fila, original, anotação, assinatura, finalização, retry e histórico aprovado. |
| Backup/restore |Banco restaurado e10 arquivos conferidos por caminho/tamanho/SHA256, com origem preservada. |

Os45 testes de imagens,11 de opções e4 de anotação integram a suíte backend; não devem ser somados outra vez. Os arquivos TRX, logs, credenciais, dumps e fotos sintéticas ficam em diretórios ignorados pelo Git.

Comandos reproduzíveis: `scripts/check.ps1`/`check.sh` por componente, runner `tests/integration/run-local.ps1` e `scripts/verify-demo-restore.ps1 -WritersStopped` após parar todos os escritores. Consulte [TESTING](TESTING.md) e [PRIMEIRO_USO](PRIMEIRO_USO.md).

## Recuperação conferida

Em23:56 JST, `susumu_dev` foi restaurado para o novo `susumu_restore_20260909145617267`:7 inspeções(6 finalizadas),71 itens,10 fotos enviadas,0 pendentes,61 auditorias e15 recibos. Registros completos de inspeções/itens/fotos e todos os arquivos coincidiram. `sourceUnchanged`, `databaseRecordsMatch`, `photoPathsLengthsAndSha256Match` e `allUploadedMetadataMatchesBytes` foram verdadeiros.

Evidência privada: `.local/demo-restore-20260909145617267/verification.json`. SHA256 dos snapshots do banco: `83ba80b9634869381a60e6d8394a6b29f0028bbe9e07575dbe6212fcb0e3c3b3`; manifesto de fotos: `90d8d75d63bed271b87047690979ffa86404c179f911ef385e3cfeee9b0fd85e`. Destino e bundle foram preservados. Isso é um ensaio local; backup externo e restauração corporativa ainda precisam de preparação operacional.

## Revisão conjunta

Claude Code real, autenticado pela CLI, escreveu o backend e participou das revisões. Codex implementou/coordenou Android, painel e operações, exerceu o contrato integrado e corrigiu achados com testes. O modelo retornado pela CLI foi `claude-opus-5[1m]`; nenhum subagente Codex foi apresentado como Claude.

Registros: [resolução backend](../backend/REVIEW_RESOLUTION.md), [imagens](../backend/IMAGE_REVIEW_RESOLUTION.md), [opções](../backend/CHECKLIST_OPTIONS_REVIEW.md), [lock administrativo](reviews/2026-09-09-admin-lock-followup.md), [catálogo](reviews/2026-09-09-vehicle-type-catalog.md), [anotação no E2E](reviews/2026-09-09-annotation-integration.md) e [consenso final Claude](reviews/2026-09-09-claude-consensus.md). O consenso final não encontrou bloqueios nas alterações revisadas. Revisões somente leitura são identificadas como tal; resultados executados são registrados separadamente.

O primeiro fixture anterior à publicação foi preservado após a detecção de uma migration inicial regenerada durante a construção; [DEV_DATABASE_CONTINUITY](DEV_DATABASE_CONTINUITY.md) registra evidência e limites. Nenhum banco de produção foi alterado.

## GitHub e artefatos

Destino autorizado: [repositório privado](https://github.com/Dukez-Jp/susumu-vehicle-check). A publicação usa branch/PR e o conector autenticado. A árvore Git remota deve coincidir byte a byte com o índice local revisado; o commit remoto terá seu próprio SHA e parent do README inicial. A linha de base local preserva os commits de preparação.

O [workflow V1 checks](../.github/workflows/ci.yml) executa backend/PostgreSQL, painel, Android e containers Linux com recriação/persistência. **Este snapshot local não declara o resultado remoto:** consulte os [Actions do commit entregue](https://github.com/Dukez-Jp/susumu-vehicle-check/actions) e o PR para status, SHA e evidência final observada pelo coordenador. O merge de entrega é condicionado a essa verificação. Artefatos de CI têm retenção de14 dias.

APK Windows DEV: `mobile/build/app/outputs/flutter-apk/app-debug.apk`,212043458 bytes, SHA256 `8ACC3B8B4CABBAFC0E74C44E4D4616D611EB15274C2AD60A2A612D935B5F574E`. O APK do CI é outro build e pode ter checksum diferente. Binários, SDKs e dados privados não fazem parte do histórico Git.

## Limites de aceitação

- Galaxy Tab Active5 Pro Wi-Fi ainda não entregue: câmera/QR/S Pen/palma/luvas, reinício físico, armazenamento e rede intermitente seguem a lista de aceite do guia.
- Nenhuma produção/VPS, túnel, MDM, certificado corporativo ou assinatura de distribuição foi implantado. O provisionamento inicial é código e instruções, testado com fixtures.
- O Windows não possui Docker Engine; containers Linux são verificados no job específico do CI, não inferidos da validação de sintaxe local.
- A proteção automática de `main` privada não é aplicada no plano GitHub observado; [ADR005](../decisions/ADR-005-github-governance.md). PR e revisão manual não substituem essa proteção.
- A tela de login web foi inspecionada visualmente. A revisão navegada autenticada ficou bloqueada pelo Chrome: outra interface de extensão estava aberta. Não se contornou o bloqueio. Componentes, relatórios e contratos tiveram testes automatizados; impressão física/PDF e navegação final fazem parte do piloto.
- Login throttle é por processo; múltiplas instâncias exigem estado compartilhado. Validação de PNG/JPEG é estrutural limitada, sem reconstrução de pixels ou antivírus. Relatórios PDF usam imprimir/salvar PDF do navegador; interface inicial em português.

Ordens de serviço, estoque, peças, custos, módulo de pneus e IA continuam fora da V1 por determinação expressa do prompt mestre.