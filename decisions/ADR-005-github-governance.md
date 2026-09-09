# ADR-005 — GitHub privado, PR e limitação do plano

Data: 2026-09-09.

Repositório privado criado e verificado: `Dukez-Jp/susumu-vehicle-check`, ID1362701729. Publicação foi expressamente autorizada pelo usuário. Segredos, banco, fotos, SDKs e arquivos temporários não entram no Git.

Na tela de criação de proteção de branch, o GitHub informou explicitamente que as regras **não serão aplicadas a este repositório privado no plano atual**. A documentação oficial também condiciona proteção em repositórios privados a planos compatíveis. Nenhuma assinatura foi comprada nem houve mudança para repositório público.

Fluxo desta entrega: branch de implementação, revisão cruzada Codex/Claude, testes locais e CI, PR e integração revisada. A exigência automática de PR/checks em `main` permanece condicionada a um plano compatível e à verificação da regra ativa. Não chamar uma regra cadastrada mas não aplicada de branch protegida.

O conector GitHub existente confirmou permissão de push. O Git CLI local não possui credencial armazenada; a publicação poderá usar o conector autenticado, sem extrair tokens. Históricos local e remoto e o SHA efetivamente publicado devem ser identificados claramente no relatório.

Fonte: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
