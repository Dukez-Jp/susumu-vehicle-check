# Banco de dados

PostgreSQL18 é a fonte central. SQLite/Drift é a persistência do tablet; os dois bancos têm responsabilidades distintas.

## Entidades e invariantes

Usuários pertencem a empresa/unidade e têm papel e estado ativo. Veículos possuem ID estável, número interno, placa, tipo e quilometragem. Templates versionados contêm seções e itens. Inspeções ligam usuário, dispositivo, veículo, template/versão, respostas, medições, observações e metadados temporais. Fotos referenciam inspeção/item e, para anotações, o original. Recibos de sincronização e auditoria são persistentes.

Funcionários são registros administrativos separados das contas; o vínculo opcional é único por empresa. Tipos de veículo têm catálogo próprio por empresa, com código imutável e nome/ativação editáveis. Veículos e templates conservam o código histórico, inclusive depois da retirada de um tipo; novas atribuições exigem um código ativo. A migration de introdução do catálogo preserva os tipos já presentes.

As opções de status são armazenadas com cada item de cada versão do checklist. `AllowedStatuses` nulo mantém as cinco opções originais; uma lista explícita preserva exatamente o subconjunto configurado. Alterar opções exige nova versão, sem reescrever inspeções existentes.

Versões otimizam detecção de concorrência, não substituem transações. Recibo de operação aceita deve ser gravado atomicamente com os dados e a auditoria. Índices únicos e regras do servidor impedem reutilização inconsistente de IDs. Todas as operações usam o escopo da identidade autenticada.

## Evolução

Migrations EF em `../backend/` são versionadas. Não usar `EnsureCreated` como fluxo de implantação PostgreSQL nem inserir fixtures nas migrations de produção. A geração e aplicação de migrations devem constar do README do backend e das instruções de execução verificadas.

Templates publicados e inspeções finalizadas não são alterados por atualizações comuns. Correções criam nova inspeção com vínculo e motivo. Desativação de usuário/veículo preserva histórico; não existe limpeza automática de inspeções de produção.

## Recuperação

Backup inclui dump PostgreSQL, fotos e manifesto de checksums. Restauração é realizada em destino novo/isolado; conferir schema, contagens, vínculos e fotos antes de promover um ambiente restaurado. O arquivo de dump contém dados sensíveis e não pertence ao repositório.

No DEV Windows desta entrega, os dados portáteis ficam em `.local/postgres/`, ignorados pelo Git. Isso não é configuração de servidor corporativo.

O tratamento do primeiro fixture anterior à publicação está registrado em [DEV_DATABASE_CONTINUITY](DEV_DATABASE_CONTINUITY.md); ele foi preservado integralmente, sem edição manual do histórico de migrations.
