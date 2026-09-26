# Continuar o projeto — onde trabalhar a partir de 14/09/2026

## Pasta ativa

```
C:\Servidor\susumu-vehicle-check
```

No PC do escritório (`hayashida2andar`) o caminho é o acima; de outro computador, abrir `\\hayashida2andar\Servidor\susumu-vehicle-check`. Em 14/09/2026 o clone saiu de `C:\Dev\susumu-vehicle-check` (notebook) para o servidor; a pasta do notebook e a cópia mais antiga `C:\Dev\SusumuVehicleCheck` (igual à `main`) deixam de ser usadas. As menções a `C:\Dev` abaixo são registro histórico.

Esta é a **única** pasta de trabalho do SUSUMU Vehicle Check. É um clone completo
do repositório privado <https://github.com/Dukez-Jp/susumu-vehicle-check>, com
branch padrão `main`.

Abra esta pasta no Codex, no Claude Code e no VS Code. Qualquer instrução antiga
que aponte o OneDrive como raiz do código está revogada por este documento.

## O OneDrive não recebe mais alterações de código

A pasta antiga foi renomeada para:

```
C:\Users\SusumuNotebook-R4\OneDrive - 株式会社ススム (1)\Particular\CODEX\_GPT_ARQUIVO_ANTIGO_2026-09-10
```

Ela é **cópia de segurança somente leitura**. Não edite, não rode a demonstração
e não commite a partir dela. Ela existe apenas para consulta histórica e para
guardar o conteúdo de `.local`, que nunca vai para o Git.

Por que a mudança foi necessária:

1. Aquela pasta **não era um repositório git**. O diretório `.git` existia, mas
   estava vazio — por isso `git commit` e `git push` falhavam ali.
2. A sincronização do OneDrive nunca terminou. Comparada com a `main`, faltavam
   **261 dos 315 arquivos**: 120 do backend .NET, 64 do mobile Flutter, 33 de
   docs, 24 de scripts e 20 entre infrastructure, `.github`, decisions, tests e
   database. Se aquela pasta tivesse virado repositório e fosse commitada, o Git
   registraria 261 remoções e o push apagaria o backend e o aplicativo Android
   do GitHub.

Por isso o trabalho foi trazido para um clone limpo, copiando **apenas arquivos
novos e alterados**, sem espelhamento e sem nenhuma remoção.

## O que fica fora do Git

`.local/` está no `.gitignore` e contém a senha do Postgres e outros segredos.
Ele **não foi copiado** para `C:\Dev` e **não deve ser**. Os 291 arquivos que
estavam lá (análises de formulários, NFC, QA do PDF, logs da demonstração)
continuam preservados na pasta de arquivo do OneDrive.

Se precisar de credenciais locais, crie o `.local` do zero em `C:\Dev` a partir
de `.env.example`, ou copie manualmente só o arquivo necessário.

## Como retomar o trabalho

```powershell
cd C:\Servidor\susumu-vehicle-check
git switch main
git pull
git switch -c feature/<assunto>-<AAAA-MM-DD>
```

Painel administrativo e demonstração:

```powershell
cd C:\Servidor\susumu-vehicle-check\admin-web
npm ci
npm test          # esperado: 27 arquivos, 274 testes aprovados
npm run lint      # esperado: sem alertas
npm run build:demo
npm run build
```

Para abrir a demonstração, dê duplo clique em `ABRIR_DEMO_TENKEN.cmd` na raiz.
O lançador usa caminho relativo, sobe o servidor local em
`http://127.0.0.1:5174/demo.html` e abre o Chrome. Não pede login nem senha.

A demonstração abre em **japonês** por padrão. As bandeiras do Japão e do Brasil
no alto da primeira página trocam o idioma de todo o aplicativo de uma vez.

## Rode os comandos com a pasta em disco local

`npm ci`, os testes e os builds precisam que a pasta esteja em disco local da
máquina que executa o comando. Pelo drive mapeado `S:` — ou pelo caminho UNC
`\\hayashida2andar\Servidor` — cada arquivo pequeno custa uma ida e volta na rede.

Medido em 15/09/2026, do notebook em Hamamatsu: o servidor responde em cerca de
41 ms e gravar 100 arquivos de 512 bytes levou 13,7 s pela rede (137 ms por
arquivo) contra 66 ms no disco local (0,66 ms por arquivo), ou seja 200 vezes
mais lento. O `npm ci` grava por volta de 30 mil arquivos e antes apaga outros
tantos: pela rede passa de uma hora e costuma ser interrompido no meio, deixando
`admin-web/node_modules` sem a pasta `.bin`. É esse estado quebrado que faz
`npm run lint` responder "eslint não é reconhecido".

Não é falta de banda nem defeito do Wi-Fi: é latência por arquivo. Abrir, editar
e ler arquivos pelo `S:` continua tranquilo; o que não funciona é qualquer
operação com dezenas de milhares de arquivos pequenos.

Execute `npm ci`, `npm test`, `npm run build` e `npm run build:demo` no PC do
escritório, onde a pasta é `C:\Servidor\susumu-vehicle-check` em disco local, ou
por acesso remoto a essa máquina.

## Os scripts locais exigem Windows PowerShell 5.1

`scripts/start-local.ps1`, `scripts/stop-local.ps1` e a parte de infraestrutura
de `scripts/check.ps1` chamam `scripts/protect-private-paths.ps1`, que usa
`GetAccessControl` e `SetAccessControl`. Esses métodos existem no .NET Framework,
não no PowerShell 7: com `pwsh` o script para com
"[System.IO.DirectoryInfo] does not contain a method named 'GetAccessControl'".
Use `powershell.exe`, que é a versão 5.1 e é o que `ABRIR_DEMO_TENKEN.cmd` já
chama.

A proteção de ACL da pasta `.local` também só funciona em disco local. Pelo `S:`
o `Get-Acl` devolve "tentativa de execução de uma operação não autorizada", e os
dois testes de ACL de `check.ps1` não podem ser executados a partir do drive
mapeado.

## Regras de publicação

- Nunca commitar direto na `main`. Trabalhe sempre em branch e abra pull request.
- Nunca usar `--force` nem `--force-with-lease` no push.
- Antes de commitar, conferir `git status`: se aparecer qualquer linha `deleted:`
  que você não pretendia, **pare** e investigue antes de seguir.

## Histórico

- Pull request da migração e do trabalho de 10/09/2026:
  <https://github.com/Dukez-Jp/susumu-vehicle-check/pull/2>
- Detalhes da coordenação entre agentes: `docs/COORDENACAO_AGENTES.md`.
