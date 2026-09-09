# ADR-001 — Stack e implantação inicial

Data: 2026-09-09. Decisão: adotada conforme prompt mestre e autorização de implementação.

Flutter/Dart e Drift/SQLite para o Android; ASP.NET Core .NET 10 e EF Core para API; PostgreSQL18 para dados centrais; React/TypeScript para administração. Monorepo privado coordena contratos, testes e versões. Fotos em armazenamento separado. Infraestrutura inicial com Docker Compose Linux e proxy HTTPS.

A cópia de desenvolvimento fica em `C:\Dev\SusumuVehicleCheck`, fora da sincronização do OneDrive. Os documentos de origem permanecem preservados. SDKs portáteis ficam fora do Git em `C:\Dev\tools`.

O Windows atual não tem Docker/WSL instalado. O banco PostgreSQL18 portátil em loopback permite testar o mesmo motor real; isso não substitui executar Compose em Linux. A validação da implantação containerizada deve ser registrada separadamente. Não trocar PostgreSQL por SQLite na implantação para contornar a limitação local.

Consequências: três toolchains e testes independentes; um contrato de API versionado evita dependência implícita entre equipes. Versões exatas de dependências ficam em arquivos de lock. Alterações de stack exigem nova decisão documentada.
