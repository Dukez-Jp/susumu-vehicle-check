# Banco central

O banco central é PostgreSQL 18. O modelo e as migrations são mantidos junto ao projeto EF Core em `backend/src/Susumu.Infrastructure/Persistence/`; não há um segundo conjunto de SQL manual concorrente.

Use o README do backend para gerar/aplicar migrations no ambiente correto. SQLite aparece somente nos testes locais do backend e no aplicativo Android; não substitui PostgreSQL em produção.

Fotos ficam fora do banco. Um backup consistente inclui o dump, os arquivos e o manifesto de checksums, sob a mesma parada de todos os escritores. Consulte [operações](../infrastructure/README.md).

Fixtures são sintéticas e dependem de habilitação explícita em Development. Nunca copiar dados de produção para desenvolvimento sem anonimização/autorização. Nunca executar `EnsureDeleted`, drops ou SQL de reparação manual para resolver falhas de produção.
