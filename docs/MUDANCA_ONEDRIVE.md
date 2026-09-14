# Mudança integral para o OneDrive — 10/09/2026

Por instrução expressa de Wagner, a pasta única do projeto neste PC é:

```text
C:\Users\Pc Forex 2025\OneDrive - 株式会社ススム\Particular\CODEX\_GPT
```

São duas pastas: `CODEX` e `_GPT`. Abra essa raiz no Codex, Claude Code e VS Code. O Claude Code real foi avisado e confirmou o novo caminho. As instruções em AGENTS.md e CLAUDE.md prevalecem sobre decisões históricas de desenvolver fora do OneDrive.

## Integridade e caminhos

- A cópia de `C:\Dev\SusumuVehicleCheck` incluiu 30.928 arquivos, 4.361.471.348 bytes e 4.455 subpastas: código, documentos, `.git`, dependências, artefatos, banco DEV, fotos e credenciais locais.
- Todos os caminhos relativos, tamanhos e hashes SHA-256 coincidiram antes dos ajustes intencionais no destino. `git fsck --full` passou. A origem foi conferida novamente antes da tentativa de exclusão.
- A antiga pasta documental `CODEX_GPT\TableSusumuSabisu` também foi consolidada: seus nove arquivos originais estão preservados em `.local/relocation-archive/TableSusumuSabisu`, como registro histórico. Não use seus caminhos antigos para iniciar o sistema.
- **Exclusão pendente por bloqueio da ferramenta:** a revisão automática rejeitou tanto a exclusão em lote quanto o comando isolado com caminho literal (`blocked by policy`). As duas pastas antigas ainda existem. Nenhuma junção, link simbólico ou alias foi criado. A pasta canônica para novas alterações é somente o destino; não trabalhe nas cópias antigas. Referências operacionais nos documentos foram atualizadas. Evidências, logs e caches históricos podem mencionar a origem, sem constituir um segundo projeto ativo.
- Os manifestos e logs de comparação ficam em `C:\Users\Pc Forex 2025\.codex\tmp\susumu-relocation-20260910`; o resultado final também fica em `.local/relocation-delivery.json`.
- As ferramentas compartilhadas em `C:\Dev\tools` são instalações externas ao projeto e permanecem neste PC. Não foram apagadas nem são transferidas automaticamente com esta pasta.

## Abrir a demonstração na empresa

1. Aguarde o OneDrive concluir o envio neste PC e o download no PC da empresa. A pasta foi marcada para permanecer no dispositivo; isso **não confirma** sincronização completa com a nuvem.
2. No PC da empresa, localize a pasta sincronizada `Particular\CODEX\_GPT` e marque **Sempre manter neste dispositivo**. O começo do caminho pode mudar conforme o usuário do Windows.
3. Instale Node.js compatível com `admin-web/package.json` e Google Chrome. Caso as dependências precisem ser regeneradas, execute `npm.cmd ci` dentro de `admin-web`.
4. Dê dois cliques em `ABRIR_DEMO_TENKEN.cmd`. A URL local será `http://127.0.0.1:5174/demo.html`.

`localhost`/`127.0.0.1` sempre aponta para o próprio PC. Os lançadores usam caminhos relativos à raiz e aceitam espaços e caracteres japoneses. Registros da demonstração ficam no armazenamento do perfil do Chrome, fora da pasta do projeto: **não acompanham o OneDrive**. O histórico permite exportar JSON; a demonstração atual não tem importação desse JSON. No segundo PC, o histórico do navegador começa separado.

## Banco DEV e desenvolvimento completo

Banco, fotos e credenciais DEV foram transferidos conforme a instrução de mover tudo; permanecem fora do Git pelo `.gitignore`. Após a validação, API, painel administrativo e PostgreSQL foram encerrados corretamente para deixar os arquivos do banco estáveis para sincronização. A demonstração independente continua disponível neste PC.

Nunca execute a mesma pasta de dados PostgreSQL simultaneamente em dois PCs. Antes de trocar de computador: encerre os serviços com `scripts/stop-local.ps1`, confirme a conclusão da sincronização nos dois lados e só então inicie no outro. Não inicie um banco cujo download esteja incompleto.

Para o ambiente completo, siga [PRIMEIRO_USO.md](PRIMEIRO_USO.md) e a documentação de ferramentas; reinstale .NET, PostgreSQL, Flutter/Android SDK conforme necessário. Os caminhos externos das ferramentas e caches de compilação não são portáveis por simples cópia. No outro PC, antes de iniciar serviços e sem nenhum processo do projeto ativo, reconfigure `.local/local-processes.json` com `version: 1`, `repository` igual à raiz local e `api`, `web`, `database` iguais a `null`; não reutilize PIDs deste computador. Preserve as credenciais e o banco. Builds Android físicos não foram revalidados nesta mudança.

## Verificações executadas no destino

- 72 testes web aprovados e `npm.cmd run build:demo` concluído.
- Demonstração aberta no Chrome, servida pelo novo caminho.
- PostgreSQL iniciado a partir de `.local/postgres/data` no destino; API e proxy do painel retornaram HTTP 200 em `/api/v1/health/ready`; demonstração retornou HTTP 200.
- Inicialização e encerramento completos executados. Corrigida espera do lançador PostgreSQL: `Start-Process -Wait` esperava também o servidor descendente; agora a espera limitada é somente pelo processo `pg_ctl` ([documentação Microsoft](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/start-process?view=powershell-5.1)).
- Scripts de ACL aceitam a família CLOUD do OneDrive, mantendo bloqueio de junções, links simbólicos e tags desconhecidas. Teste com junção real confirmou que a ACL do alvo externo não foi alterada.
- Testes de identidade de processos confirmaram bloqueio de processo alheio, PID reutilizado e troca de identidade durante encerramento.

A sincronização completa com o OneDrive e a execução no computador da empresa ainda precisam ser verificadas naquele ambiente. A mudança não altera o limite DEV nem substitui os testes no tablet físico.
