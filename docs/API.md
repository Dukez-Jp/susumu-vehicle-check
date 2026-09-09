# API

Contrato compartilhado: [IMPLEMENTATION_CONTRACT.md](IMPLEMENTATION_CONTRACT.md). Prefixo `/api/v1`, JSON camelCase, UUIDs e timestamps ISO8601UTC. O código e os testes de endpoints em `../backend/` devem ser confrontados com este contrato na integração.

Autenticação ocorre por login e token bearer. Endpoints de recursos exigem identidade ativa e autorizada. O cliente web usa mesma origem/proxy; não enviar token em query string nem carregar anexos privados por URL pública.

Principais grupos: auth, bootstrap, company, locations, employees, vehicle-types, vehicles, templates, inspections, sync, photos, dashboard, users, audit e exports. Health não expõe credenciais. OpenAPI do backend auxilia inspeção do contrato, mas não substitui testes de permissão.

O catálogo de tipos mantém códigos estáveis por empresa. Consulta autenticada permite ao Supervisor escolher tipos ao editar checklists; criar/alterar tipos é restrito ao Administrador. Itens do template incluem `allowedStatuses` opcional, com valores padrão compatíveis com versões antigas. A API aplica as opções da versão exata ao finalizar; rascunhos continuam podendo registrar trabalho incompleto.

Sync recebe `operationId`, `expectedVersion` e o agregado `inspection`. Repetir um `operationId` com o mesmo conteúdo devolve o recibo aceito. Conteúdo divergente ou versão conflitante retorna409. Cliente mantém a operação até receber confirmação consistente; timeout não significa que o servidor não gravou.

Erro de autenticação401 exige renovação da sessão. Falta de permissão403 não deve entrar em retry infinito. Validação400 e conflito409 exigem intervenção explícita; indisponibilidade/rede/429 permitem retry controlado. Respostas de erro não podem conter senha, token, connection string ou stacktrace de produção.

Uploads têm endpoint autorizado por inspeção/foto, multipart `file` e `metadata`. Original e anotação têm IDs próprios. Checksums e metadados verificam que retry corresponde ao mesmo objeto. Estado `Pending` informa bytes ainda não recebidos, mesmo que respostas estejam finalizadas.
