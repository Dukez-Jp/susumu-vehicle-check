# Susumu Vehicle Check — administração web

Aplicação React/TypeScript V1 em português, com dados reais da API `/api/v1`. Não há credenciais padrão, dados demonstrativos ou caminho de sucesso simulado no aplicativo. Fixtures existem somente nos testes.

## Executar localmente

Requer Node.js 24 ou superior e a API com banco migrado. Na pasta `admin-web`:

```powershell
npm.cmd ci
npm.cmd run dev
```

Abra **http://127.0.0.1:5173**. O proxy do Vite encaminha `/api` para `http://localhost:5080`. Para outro endereço de desenvolvimento, copie `.env.example` para `.env.local`, configure `API_PROXY_TARGET` e reinicie o Vite. Essa variável pertence ao servidor de desenvolvimento; o navegador usa sempre o mesmo domínio para a API.

Em produção, `npm.cmd run build` gera `dist/`. O servidor HTTPS deve servir o aplicativo com fallback para `index.html` e encaminhar `/api/v1` ao backend. Não publicar com `vite dev` ou `vite preview`. A implantação é coordenada na raiz do repositório.

## Áreas implementadas

- Login com token somente em memória, encerramento por expiração/401, limpeza de consultas ao sair e controle de rotas por perfil.
- Visão da oficina com contagens e inspeções reais, itens críticos e inspeções com fotos pendentes.
- Tipos de veículo: cadastro administrativo com código permanente, nome e ativação. O catálogo da própria empresa alimenta os seletores de veículos e checklists, inclusive para supervisores. Desativar preserva referências históricas e impede novos vínculos.
- Veículos: pesquisa, cadastro/edição administrativa, seleção de unidade e tipo, QR de identificação e histórico paginado. Um tipo retirado pode permanecer no veículo existente. Quilometragem desconhecida permanece em branco; valores registrados são inteiros e não podem ser reduzidos ou apagados pelo formulário.
- Checklists: seções/itens, ordenação, obrigatoriedade, seleção das opções padrão de resposta, medições, unidade, limites de entrada e assinatura exigida. Opções ausentes/nulas mantêm os cinco status; subconjuntos são preservados por versão. Medições aceitam até quatro casas decimais na faixa da API, sem arredondamento silencioso. Salvar cria uma versão com tipo ativo; publicar congela a definição. Ativação/desativação altera disponibilidade sem editar os itens publicados.
- Inspeções: filtros, paginação, versão exata do checklist, correção ligada ao original, status/valores/observações, fotos originais/anotadas e assinatura. Bytes das fotos são consultados com autenticação e exibidos por URLs temporárias revogadas ao desmontar a tela.
- Ao abrir um relatório, as correções são consultadas diretamente por `supersedesInspectionId`, com paginação, independentemente da idade e das outras inspeções do veículo. A ausência de resposta dessa consulta fica explícita no relatório. Uma página cheia não é apresentada como contagem total de revisões.
- Relatório para imprimir/salvar PDF no navegador. O botão aguarda as consultas das fotos e a decodificação das imagens. Pendências, falhas de exibição, assinatura declarada e rascunhos ficam explícitos no relatório; uma inspeção finalizada pode continuar com fotos pendentes.
- Exportação CSV autenticada pelo endpoint do servidor; escaping contra fórmulas é responsabilidade da API. O CSV abrange os registros disponíveis para o acesso, não somente os resultados já carregados na tela.
- Pessoas/perfis, empresa, unidades e funcionários separados das identidades de login. Unidades existentes de usuários permanecem somente leitura, conforme contrato. A desativação de funcionário não desativa a conta vinculada.
- Auditoria paginada e filtrada por inspeção, disponível a administrador/supervisor.

## Segurança e comportamento de falha

Não se usa `localStorage`, `sessionStorage` ou cookie para o token. Recarregar/fechar a página exige novo login. O servidor valida perfil, empresa, unidade e ativação em cada solicitação; esconder um botão não substitui essa autorização.

O painel precisa de conexão para consultar e salvar. Os formulários web **não criam uma fila offline**: uma tentativa sem rede falha visivelmente, sem ser retomada silenciosamente sob outra sessão. Escritas não têm retry automático. Respostas perdidas após uma escrita são tratadas como resultado não confirmado: confira a lista antes de repetir. A aplicação Android é responsável pelo trabalho offline durável.

Dados carregados ficam somente na memória da sessão. Formulários mantêm os valores quando a API rejeita a gravação; não persistem rascunhos administrativos após fechar/recarregar. Nomes/status compartilhados e formatação estão em `src/i18n.ts`; a entrega atual tem somente a experiência em português, sem tradução japonesa completa.

Os filtros de data, ocorrências e pendência de fotos operam sobre as páginas de inspeções já carregadas. Use **Carregar mais registros** para ampliar a busca; veículo/situação são enviados ao servidor. A consulta não promete ausência de ocorrências em páginas ainda não carregadas.

## Verificação

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run format:check
npm.cmd run build
```

Testes cobrem erros/autenticação, troca/expiração de sessão, rejeição de acesso, ausência de persistência de tokens, escritas sem rede, validação de checklist/usuário/funcionário/quilometragem, tipos de veículo, opções imutáveis por versão, paginação, campos preservados após rejeição e relatórios com fotos/assinatura pendentes. Testes de interface usam respostas sintéticas isoladas; não comprovam integração com PostgreSQL nem operação física do tablet.

Para conferência visual com a API DEV: entrar → veículo → histórico → relatório; criar versão de checklist com medição mínima zero e assinatura → conferir → publicar; testar acesso Office a `/users`; conferir empresa/unidades/funcionários; exportar CSV; reduzir a viewport e imprimir o relatório. Evidências da integração e da revisão independente são registradas pelo coordenador na documentação do projeto.
