# Requisitos do produto

## Objetivo e contexto

Sistema de check-in e inspeção de veículos/caminhões da oficina, com aplicativo Android que mantém o trabalho quando a rede falha e painel de escritório para administrar cadastros, checklists e histórico. A fonte original está preservada em `source/PROMPT_MESTRE_2026-09-09.txt`.

Hardware comprado: uma unidade Samsung Galaxy Tab Active5 Pro Wi-Fi, ainda aguardando entrega em2026-09-09. O SKU e a configuração recebidos serão conferidos na chegada. O aparelho físico não foi testado nesta implementação.

## Fluxo V1

Autenticar funcionário; identificar veículo por número, placa ou QR; confirmar quilometragem; escolher template publicado compatível; preencher status, medições, observações e fotos; anotar uma cópia com caneta; salvar continuamente; retomar trabalho interrompido; revisar e finalizar; sincronizar ao reconectar; consultar histórico, relatório e auditoria.

Status por item: OK, Atenção, Reparar, Crítico e Não aplicável. Os limites mínimo/máximo de medição definidos no template são limites de entrada plausível. Eles não equivalem a diagnóstico automático ou limite de segurança mecânica: o inspetor registra a condição no status. Checklists de negócio devem ser validados pela oficina; os exemplos DEV não certificam conformidade legal de inspeção.

Painel: dashboard, veículos, publicação de novas versões de checklist, inspeções, anexos autorizados, usuários/perfis, auditoria, exportação CSV e relatório imprimível/PDF. Texto inicial em português. A arquitetura permite tradução; tradução japonesa completa deve ser explicitamente validada antes de prometer disponibilidade.

## Integridade e segurança

- Salvamento confirmado somente após persistência local; agregado e fila na mesma transação.
- Retry não duplica inspeções ou fotos; conflito fica visível e não sobrescreve dados.
- Template publicado e inspeção finalizada não mudam silenciosamente.
- Correção gera novo registro relacionado; original permanece acessível.
- Original da foto separado da anotação; anexos pendentes ficam identificados.
- Servidor aplica escopo/perfil; senhas com hash seguro; tokens fora do Git e do armazenamento web persistente.
- Sem alteração direta de banco de produção por agentes. Schema por migrations e backup recuperável.

## Limites da primeira versão

Ordens de serviço, peças, estoque, pneus como módulo próprio, compras, custos e IA são extensões futuras, conforme o prompt mestre. A inspeção pode registrar esses componentes como itens configuráveis, sem inventar os módulos transacionais.

Inspeções simultâneas sobre um veículo são independentes; colaboração na mesma inspeção não faz parte do V1. Assinatura é opcional, pois o prompt a exige apenas quando aplicável. O template inicial não impõe assinatura. Um tablet sem conexão não substitui backup externo contra perda física do aparelho.

## Aceite

A matriz de entrega deve separar código implementado, testes automatizados, integração real, teste físico e validação operacional. Produção exige todos os critérios do capítulo23 do prompt, mais confirmação da oficina sobre checklist, papéis, continuidade sem tablet e retenção. Um build verde sozinho não atende o aceite operacional.
