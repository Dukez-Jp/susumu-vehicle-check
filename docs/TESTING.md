# Estratégia de testes

Executar verificações locais conforme `scripts/` e cada README de componente. GitHub Actions deve construir e testar backend, web e mobile. Jobs só podem ser declarados verdes após execução real; um teste pulado por falta de PostgreSQL não conta como integração aprovada.

## Camadas

- Backend: validação de agregado, perfis/escopo, idempotência, conflito, finalização imutável, template congelado, uploads, auditoria e CSV.
- Mobile: SQLite real temporário, fechamento/reabertura, transação agregado/fila, estabilidade do payload após tentativa, fila por usuário, validação e widgets.
- Web: sessão, erro de API, permissões da interface, editor de template, reporte de fotos pendentes, lint/typecheck/build.
- Integração real: PostgreSQL18 migrado, login, veículo714 sintético, template publicado, draft, finalização, retry e histórico. Fotos e backup/restore em destino isolado.

## Evidência

Relatório final deve informar comandos, resultados, contagens, versões, commits e limitações. Não persistir tokens ou dumps em logs versionados. Fixtures representam dados fictícios; nenhum dado de produção é usado.

## Integração local reproduzível

Depois de iniciar o ambiente nativo com `./scripts/start-local.ps1`, execute da raiz:

```powershell
./tests/integration/run-local.ps1
```

O runner usa as credenciais DEV ignoradas pelo Git, sem imprimi-las. Exercita primeiro o contrato HTTP com Node e depois a implementação real Dart/Drift contra a API e PostgreSQL. A opção `-SkipMobile` seleciona apenas a primeira parte. Cada execução cria novos registros sintéticos; não apaga os resultados anteriores. O relatório sem credenciais fica em `artifacts/api-smoke.json`.

O teste Node inclui autorização, veículo714, JSON exato, rascunho, idempotência, conflito, finalização, original imutável, assinatura pendente, retirada de template sem perda de histórico, paginação e cadastros administrativos. O teste Flutter usa o banco local, editor e sincronizador reais. Falhas nesses testes bloqueiam a alegação de integração concluída.

## Aceite físico pendente da entrega

Instalar APK de teste, usar câmera/QR/caneta, alternar orientações, desligar Wi-Fi, forçar parada/reiniciar, recuperar rascunho, sincronizar com rede intermitente, testar tempo de uso/armazenamento e luvas reais. Antes de produção, também validar HTTPS, MDM, permissões reais, backup e restauração corporativa.
