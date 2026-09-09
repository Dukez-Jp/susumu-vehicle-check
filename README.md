# SUSUMU VEHICLE CHECK

Inspeções de veículos na oficina, com aplicativo Android que salva o trabalho no tablet e sincroniza com o servidor quando a conexão volta. O escritório acompanha a frota, administra checklists e consulta relatórios em um painel web.

**V1 implementada para avaliação DEV.** O Galaxy Tab Active5 Pro Wi-Fi já foi comprado e ainda está a caminho. A compilação do APK e os testes automatizados não substituem a aceitação física de câmera, S Pen, reinício e rede intermitente. O código está no [repositório privado do projeto](https://github.com/Dukez-Jp/susumu-vehicle-check); nenhum servidor de produção foi implantado por esta tarefa.

Os resultados de testes, restauração e revisão conjunta estão no [relatório técnico de entrega](docs/ENTREGA_V1.md). O resultado remoto de CI acompanha o commit e o PR no GitHub.

## O que compõe o produto

| Componente | Responsabilidade | Tecnologia |
|---|---|---|
| [Android](mobile/README.md) | Identificação por QR/placa/número, checklist, medições, fotos e anotações, assinatura, rascunhos, fila e histórico | Flutter, Dart, Drift/SQLite |
| [API](backend/README.md) | Autenticação e escopo, cadastros, versões, inspeções, idempotência, anexos e auditoria | ASP.NET Core / EF Core, .NET 10 |
| [Painel web](admin-web/README.md) | Dashboard, veículos, empresa/unidades, funcionários, usuários, checklist e relatórios | React, TypeScript |
| [Operações](infrastructure/README.md) | PostgreSQL, fotos separadas, proxy, backup/restore e configuração de ambientes | PostgreSQL 18, Docker Compose, Caddy |

Fotos originais permanecem separadas das cópias anotadas. Inspeções finalizadas preservam a versão exata do checklist. Correções geram outro registro ligado ao original. Pendências e conflitos ficam visíveis; o sistema não resolve divergências apagando trabalho.

## Abrir neste computador Windows

O checkout de desenvolvimento fica em `C:\Dev\SusumuVehicleCheck`, fora do OneDrive. O toolchain portátil desta máquina está em `C:\Dev\tools`; ele não é uma dependência dos builds Linux/CI.

```powershell
Set-Location C:\Dev\SusumuVehicleCheck
./scripts/start-local.ps1
```

O painel usa `http://127.0.0.1:5173` e a API `http://127.0.0.1:5080/api/v1`. Credenciais locais são geradas em `.local/local-runtime-secrets.json`, ignorado pelo Git; abra esse arquivo apenas no computador autorizado. Senhas de teste nunca são publicadas no repositório. O banco e as fotos deste ambiente usam exclusivamente dados sintéticos.

Para encerrar os processos gerenciados pelo script:

```powershell
./scripts/stop-local.ps1
```

Esse modo utiliza o cluster PostgreSQL portátil já preparado nesta máquina. Em outro computador, siga a instalação do componente ou use Docker Compose.

## Executar com Docker Compose

Pré-requisitos: Docker Engine com Compose e Python 3.11+. Gere credenciais próprias antes de iniciar:

```bash
python scripts/generate_dev_env.py
docker compose up --build -d
```

Abra `http://127.0.0.1:8080`. As credenciais DEV ficam no arquivo ignorado `.local/dev-credentials.json`. Não descarte volumes para solucionar uma falha de inicialização. O [guia de operações](infrastructure/README.md) descreve persistência, HTTPS, backup, restauração e os limites do ambiente atual.

## Verificar

SDKs coordenados: .NET 10.0.401, Flutter 3.47.2/Dart 3.13.2, Node 24, JDK 17, Android SDK 36 e PostgreSQL 18. Os lockfiles fazem parte do código.

```powershell
. 'C:\Dev\tools\SUSUMU-env.ps1'
./scripts/check.ps1 -Component Infrastructure
./scripts/check.ps1 -Component Backend
./scripts/check.ps1 -Component Web
./scripts/check.ps1 -Component Mobile -BuildApk
```

Em Linux, use `bash scripts/check.sh infrastructure`, `backend`, `web` ou `mobile`. O fluxo integrado real tem instruções e variáveis de ambiente em [TESTING](docs/TESTING.md). O workflow [V1 checks](.github/workflows/ci.yml) inclui backend/PostgreSQL, painel, Android e containers Linux.

O APK de avaliação fica em `mobile/build/app/outputs/flutter-apk/app-debug.apk` e nos artefatos do job Android quando o CI conclui. É um build DEV, sem assinatura corporativa de distribuição. O tablet físico deve acessar um endereço HTTPS de teste alcançável na rede; `localhost` no tablet aponta para o próprio tablet.

## Documentação e continuidade

- [Primeiro uso para Wagner](docs/PRIMEIRO_USO.md), com o fluxo de inspeção, prévias das telas e a aceitação física do tablet.
- [Requisitos](docs/PRODUCT_REQUIREMENTS.md), [prompt original](docs/source/PROMPT_MESTRE_2026-09-09.txt) e [contrato compartilhado](docs/IMPLEMENTATION_CONTRACT.md).
- [Arquitetura](docs/ARCHITECTURE.md), [banco](docs/DATABASE.md), [API](docs/API.md), [offline/sync](docs/OFFLINE_SYNC.md), [segurança](docs/SECURITY.md) e [UX](docs/UI_UX.md).
- [Testes](docs/TESTING.md), [implantação](docs/DEPLOYMENT.md), [operações](docs/OPERATIONS.md) e [decisões ADR](decisions/).
- [Plano de implementação](docs/superpowers/plans/2026-09-09-v1.md), [revisão de integração](docs/INTEGRATION_REVIEW.md) e [governança do GitHub](decisions/ADR-005-github-governance.md).

Codex e Claude Code trabalham sobre este mesmo contrato e registram decisões no repositório. Os limites dos agentes estão em [AGENTS.md](AGENTS.md) e [CLAUDE.md](CLAUDE.md). A revisão cruzada e o CI precedem o merge. A proteção automática de branch privada depende de um plano GitHub compatível e precisa ser confirmada no repositório.

Ordens de serviço, estoque, peças, custos, gestão de pneus e IA são módulos futuros expressamente separados da V1 pelo prompt mestre.
