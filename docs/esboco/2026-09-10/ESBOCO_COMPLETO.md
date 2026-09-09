# SUSUMU VEHICLE CHECK — esboço completo do piloto

**Data:** 10/09/2026. **Fase:** desenho e revisão documental. **Estado:** proposta para avaliação de Wagner. **Hardware:** um único Samsung Galaxy Tab Active5 Pro Wi-Fi já comprado, aguardando entrega. Nenhuma compra adicional faz parte deste plano.

A instrução vigente é trabalhar somente no esboço, com testes e subtestes, sem programar. A V1 produzida anteriormente é preservada como referência histórica. Este documento não afirma que suas propostas estejam implementadas, que novos testes tenham sido executados ou que o produto esteja aprovado para produção. Nenhum comando operacional deve ser executado por causa deste esboço.

Leia em conjunto a [matriz de testes e subtestes](TESTES_E_SUBTESTES.md) e a [revisão conjunta com Claude Code](REVISAO_CONJUNTA.md). As decisões empresariais ainda abertas aparecem como **[CONFIRMAR]**. Os números usados como critérios experimentais são **PROPOSTAS**, não metas já aprovadas.

## 1. Resultado que queremos demonstrar

Um operador identifica o veículo correto, registra uma inspeção no tablet mesmo sem Wi-Fi, retoma trabalho interrompido e envia os registros quando a conexão volta. O escritório consulta o mesmo registro, distingue anexos pendentes de recebidos e encontra a versão do checklist usada. O original de cada foto e o histórico de uma inspeção finalizada permanecem preservados nas falhas operacionais cobertas; os limites da perda física de dados sem cópia externa estão na seção 8.

Finalizar uma inspeção significa encerrar o registro de observações. **Não significa liberar o veículo para circulação, atestar sua segurança ou resolver automaticamente um defeito.** O procedimento da oficina para itens Críticos depende de responsável e decisão explícitos.

O piloto verifica esse fluxo limitado. Não valida automaticamente uma frota inteira, vários tablets, uso de produção ou todos os cenários futuros.

## 2. Escolha de organização do piloto

| Alternativa | Benefício | Limitação | Posição neste esboço |
|---|---|---|---|
| Um tablet, pequeno grupo de operadores identificados, dados sintéticos e checklists selecionados | Permite observar a rotina completa e a troca de usuário, com custo inicial controlado | Não demonstra concorrência física entre dois tablets nem continuidade por aparelho reserva | **Proposta recomendada**, respeitando a compra de uma unidade |
| Um tablet e apenas um operador fixo | Simplifica treinamento inicial | Deixa troca de conta e responsabilidades de turno sem validação | Pode ser o primeiro exercício, não encerra o piloto completo |
| Ampliar equipamentos e módulos agora | Aumentaria cenários disponíveis | Aumenta custo e dispersa a avaliação antes do primeiro aceite | Fora da fase atual |

Serão necessárias contas individuais mesmo usando um único aparelho. Dois operadores podem testar em horários diferentes; não se propõe uma segunda compra para isso. Um computador do escritório é o outro lado do fluxo. Duração, participantes e disponibilidade desse computador são **[CONFIRMAR]**.

## 3. Mapa completo dos módulos

| Área | O que o desenho contempla | Resultado esperado no piloto |
|---|---|---|
| Acesso | Login, sessão, perfis, troca de operador e limite de uso offline | Cada pessoa vê e envia somente o trabalho autorizado |
| Organização | Empresa, unidades, funcionários e vínculo opcional com conta | Responsabilidade identificável sem confundir cadastro de funcionário com login |
| Frota | Veículo, tipo, número interno, placa, unidade, ativo/inativo e QR | Identificação inequívoca antes da inspeção |
| Checklist | Seções, ordem, itens, obrigatoriedade, opções, medições, limites e assinatura | Definição administrável pelo escritório e versão preservada |
| Inspeção | Quilometragem, respostas, observações, progresso, rascunho e finalização | Registro completo e retomável |
| Evidências | Original, cópia anotada, vínculo com item e assinatura quando exigida | Evidência preservada e recuperável, com situação de envio visível |
| Trabalho offline | Catálogo previamente disponível, salvamento, retomada e fila | Trabalho confirmado não desaparece ao perder rede ou fechar o aplicativo |
| Sincronização | Reenvio seguro, ordem por inspeção, anexos pendentes e conflitos | Uma operação repetida não cria outro registro; divergências ficam explícitas |
| Escritório | Dashboard, busca, inspeções, anexos, histórico, relatório e exportação | O escritório reconhece problemas e limitações do que está consultando |
| Auditoria e continuidade | Autoria, horários, alterações administrativas, correções, backup e recuperação | Há rastreabilidade e procedimento para interrupções |

Ordens de serviço, peças, estoque, compras, custos, gestão de pneus, BI e IA são extensões futuras. Um item de checklist pode mencionar pneu ou freio; isso não constitui um módulo de manutenção, estoque ou diagnóstico. A futura ligação entre um problema e uma ordem de serviço é prevista conceitualmente, sem desenho de implementação nesta fase.

## 4. Pessoas e responsabilidades propostas

| Papel | Responsabilidade proposta | Limite / decisão necessária |
|---|---|---|
| Inspetor / mecânico em inspeção | Identificar veículo, preencher seu registro, incluir evidências e finalizar o próprio trabalho | **[CONFIRMAR]** se Mecânico usa este mesmo perfil e se a finalização exige Supervisor |
| Supervisor | Rever ocorrências, coordenar correções e administrar definições de checklist quando autorizado | **[CONFIRMAR]** quem recebe Crítico e como registra encaminhamento fora do aplicativo |
| Escritório | Consultar frota, histórico e relatórios no escopo autorizado | Consulta não deve virar edição de registros finalizados |
| Administrador | Manter contas, unidades, veículos, tipos e permissões | Não equivale a autorização para alterar evidência histórica |
| Responsável pelo piloto | Preparar dados de teste, observar, guardar evidências e decidir aceite | Pessoa e substituto **[CONFIRMAR]** |

O contrato técnico anterior menciona Supervisor e Inspetor com redações que permitem leituras diferentes sobre finalização. A proposta acima torna a dúvida explícita; ela não muda permissões existentes nem aprova uma política empresarial.

**Encaminhamento de Crítico — proposta operacional:** comunicar ao responsável definido pela oficina e registrar, por um meio controlado já autorizado, o identificador da inspeção/veículo, ocorrência, quem recebeu, horário, decisão humana, responsável e acompanhamento. Canal, tempo de resposta e autoridade são **[CONFIRMAR]**. No piloto, esse registro pode ser observado manualmente; não se presume uma tela de liberação, notificação automática ou módulo de ordem de serviço existente, nem se programa um deles nesta fase.

## 5. Jornada de ponta a ponta

```text
PREPARAR
  Contas individuais + veículo sintético + checklist revisado + rede de teste
       ↓
ENTRAR E CONFERIR
  Operador / unidade / servidor de teste / dados disponíveis offline
       ↓
IDENTIFICAR
  Pesquisar ou ler QR → conferir número e placa → confirmar veículo
       ↓
INICIAR
  Quilometragem → checklist e versão → abrir rascunho
       ↓
INSPECIONAR
  Resposta explícita → medição/nota → foto → cópia anotada quando útil
  Cada alteração mostra seu estado de salvamento
       ↓
REVISAR
  Pendências obrigatórias + problemas + evidências + assinatura exigida
       ↓
FINALIZAR O REGISTRO
  Confirmação → registro encerrado no tablet
       ↓
ACOMPANHAR ENVIO
  Dados e anexos pendentes / confirmados / revisão necessária
       ↓
CONFERIR NO ESCRITÓRIO
  Mesma inspeção + versão + autor + anexos + histórico e relatório
```

Um rascunho pode ser retomado antes da finalização. Falta de Wi-Fi não impede trabalhar dentro das condições offline aprovadas. Uma falha de armazenamento impede anunciar salvamento. Finalização e conclusão do envio são estados diferentes.

## 6. Esboço das telas do tablet

Os quadros são rascunhos textuais, sem código, sem interface executável e sem promessa de correspondência com a V1 anterior. Rótulos finais, idioma e acessibilidade devem ser validados com os operadores.

### E01 — Entrada e sessão

```text
SUSUMU CHECK                       AMBIENTE DE TESTE
Servidor / oficina: [identificação compreensível]
Operador: [conta individual]       Senha: [oculta]
[ Entrar ]
Situação: conexão disponível / indisponível / autenticação necessária
```

Na primeira entrada, explicar que o catálogo deve estar disponível antes do uso offline. Em troca de servidor/operador, mostrar aviso genérico de que há trabalho de outra sessão preservado, sem revelar veículo, foto ou nome. Erro de acesso deve orientar a ação possível, sem sucesso fictício. Testes T01, T02 e T09.

### E02 — Minha oficina

```text
Operador e unidade                 OFFLINE | dados atualizados em ...
[ Pesquisar número ou placa .......... ]   [ Ler QR ]
[ Novo check-in ]
Rascunhos: [ veículo | progresso | salvo em ... | Continuar ]
Envios: [ pendentes ... | revisão necessária ... | Ver fila ]
```

Exibir o significado dos estados por texto e ícone, não somente por cor. Diferenciar lista vazia, carregando, erro e catálogo não disponível. Testes T03, T04, T08, T09 e T19.

### E03 — Confirmar veículo e iniciar

```text
Número interno: 714                Placa: [sintética]
Tipo / unidade / situação do cadastro
Última quilometragem conhecida: ...   Atualização do dado: ...
Quilometragem observada: [ ........ ]
Checklist: [nome]                  Versão: [ ... ]
[ Voltar ]                        [ Confirmar e iniciar ]
```

Um QR identifica um cadastro; não comprova que a etiqueta foi colocada no veículo correto. A conferência é parte explícita do procedimento. Leitura inferior, troca de odômetro ou cadastro divergente não devem ser resolvidos inventando quilometragem. Testes T04 e T05.

### E04 — Checklist em andamento

```text
714 | Checklist / versão           RASCUNHO | Salvo no tablet / Salvando
Seção atual                       Progresso: respondidos / previstos
Item: [nome claro]
[ OK ] [ Atenção ] [ Reparar ] [ Crítico ] [ N/A ]  ← opções permitidas
Medição: [ ........ ] [unidade]     Observação: [ ................ ]
[ Foto ] [ Ver anexos ]
[ Seção anterior ]                [ Próxima seção ] [ Revisar ]
```

Não preencher um item automaticamente como OK. Ausência de resposta é diferente de N/A escolhido explicitamente. Uma medição mantém unidade e número visíveis, inclusive entrada parcial ainda inválida. Progresso respondido não equivale a registro apto a finalizar. Testes T06, T07 e T08.

### E05 — Fotos e anotações

Mostrar item, original e cópias identificados separadamente. A ação Anotar abre uma cópia; Salvar cópia preserva o original. Cancelar desenho deixa o original intacto. A lista informa salvamento e envio de cada anexo. Captura interrompida, permissão negada ou falha de espaço exigem aviso recuperável, sem orientar a limpar os dados do aplicativo. Testes T10, T11 e T14.

### E06 — Revisão e assinatura

Mostrar problemas por status, itens obrigatórios pendentes, medições inválidas e situação das evidências. Se assinatura for exigida, permitir revisar e refazer antes da confirmação. Desenho vazio não conta como assinatura. A assinatura é evidência operacional; este esboço não lhe atribui certificação ou efeito jurídico específico. Testes T07, T11 e T12.

### E07 — Finalização

```text
Revisar antes de encerrar: veículo / autor / checklist / problemas
Pendências que impedem finalizar: [ ... ]
Anexos ainda não enviados: [ ... ]
Aviso: finalizar encerra o registro; não libera o veículo
[ Voltar à revisão ]              [ Confirmar finalização ]
```

Confirmar offline é uma proposta condicionada à política de sessão e ao checklist aprovado. Se permitido, o registro fica finalizado localmente com envio pendente. Não há mensagem de recebimento no escritório antes da confirmação efetiva. Testes T09, T12 e T14.

### E08 — Fila e conflitos

Cada inspeção apresenta dados pendentes, fotos pendentes, última tentativa e ação disponível. Reenviar uma operação é diferente de criar uma cópia. Uma rejeição não deve paralisar outras inspeções elegíveis. Uma cópia para revisão exige motivo e conferência do histórico; ela não substitui ou apaga a operação rejeitada. Testes T13, T14 e T15.

### E09 — Histórico e correções

Histórico apresenta data, autor, versão do checklist, situação de anexos e vínculos entre original/correção. Carregar mais registros não pode perder ou duplicar linhas. Offline, identificar que a consulta cobre somente dados disponíveis no tablet. Corrigir cria outro registro ligado ao original; assinatura exigida deve ser colhida novamente. Testes T12 e T16.

### E10 — Avisos e trabalho preservado

Avisos de espaço, sessão expirada, câmera interrompida e evidência faltante indicam o que está preservado e o próximo passo autorizado. A troca de usuário não revela os detalhes de outra pessoa. Um aviso não pode confundir arquivo inacessível com arquivo comprovadamente ausente. Testes T08, T09, T10, T17 e T18.

## 7. Esboço do painel do escritório

| Tela | Conteúdo / ação | Estados importantes | Testes |
|---|---|---|---|
| Entrada | Conta individual e ambiente | Sem acesso, sessão expirada, servidor indisponível | T01, T02 |
| Dashboard | Frota no escopo, inspeções, problemas, anexos pendentes | Período consultado e limitações; dados ainda offline não aparecem como recebidos | T16 |
| Veículos e tipos | Cadastro, QR, quilometragem conhecida, ativo/inativo, histórico | Tipo desativado preserva referências antigas; código estável | T03, T04, T05 |
| Empresa, unidades, funcionários e contas | Cadastro e vínculo, perfil, situação | Desativar funcionário não equivale automaticamente a desativar login; evitar conta compartilhada | T02, T03 |
| Editor de checklist | Seções, ordem, opções, limites, unidade, assinatura e prévia | Rascunho, publicado, substituído e retirado; versão antiga imutável | T06 |
| Inspeções e evidências | Filtros, detalhe, problemas, original/anotação, pendências | Consulta não permite reescrever finalizada nem esconder anexos faltantes | T12, T14, T16 |
| Relatório e exportação | Veículo, autor, datas, versão, resultados e anexos | Relatório identifica correções e envio incompleto; conteúdo de notas não vira comando de planilha | T16, T17 |
| Auditoria | Ações, autores, horários e vínculos | Escopo autorizado, paginação e eventos identificáveis | T02, T12, T16 |

## 8. Regras do desenho e limites de evidência

1. **Salvo** somente após confirmação de armazenamento. Escolher status, editar texto/número e incluir um anexo solicitam salvamento; o desenho não depende apenas de sair do campo ou trocar de seção. Enquanto a gravação não for confirmada, a alteração permanece visivelmente não confirmada, inclusive texto numérico parcial. T08.2 compara a interrupção com a última versão confirmada, sem presumir que tocar no controle já concluiu a gravação.
2. **Original e anotação separados.** Cancelar desenho ou reenviar arquivo não reescreve o original.
3. **Três perguntas separadas:** o registro foi salvo no tablet? Foi finalizado? Dados e todos os anexos declarados foram recebidos?
4. **Repetição conserva identidade.** Após resposta perdida, uma tentativa idêntica recupera o resultado aceito; conteúdo diferente não usa a mesma operação como se fosse repetição.
5. **Divergência exige revisão.** Não escolher silenciosamente o último registro recebido. O envio de uma inspeção antiga não deve reduzir a quilometragem conhecida.
6. **Versão acompanha a inspeção.** Publicar opções novas não muda significado de respostas antigas. N/A explícito é válido somente se permitido nessa versão; item obrigatório exige uma resposta explícita, não necessariamente uma resposta diferente de N/A.
7. **Autoria e escopo persistem.** Sair da conta preserva o trabalho, mas não transfere propriedade ou autorização para a próxima pessoa.
8. **Histórico final preservado.** Correções mantêm vínculo e motivo. Desativação de cadastro é diferente de exclusão de histórico.
9. **Crítico exige procedimento humano.** O encaminhamento, responsável e autorização de retorno à operação são decisões da oficina, fora de uma promessa automática do sistema.
10. **Offline não é backup externo.** Destruição ou perda do único tablet antes do envio pode tornar impossível recuperar trabalho ainda não copiado. Não prometer recuperação desses dados pelo servidor.
11. **Inacessível não equivale a ausente.** Falha de permissão, erro de leitura ou estrutura de armazenamento danificada exige preservação e diagnóstico.
12. **O piloto usa dados sintéticos.** Nenhum resultado do esboço comprova inspeção mecânica, conformidade normativa ou aptidão de veículo real.
13. **Limite numérico não é diagnóstico.** Mínimo e máximo do checklist validam plausibilidade da entrada; um valor nesse intervalo não significa aprovação mecânica. A oficina define critérios e o operador registra a condição observada.

## 9. Modelo conceitual, sem schema novo

```text
Empresa → unidades → veículos e pessoas
Pessoa / conta → permissão → inspeção de sua responsabilidade
Tipo de veículo → versões publicadas de checklist
Inspeção → veículo + autor + unidade + dispositivo + versão escolhida
Inspeção → respostas / medições / observações
Item → fotos originais → cópias anotadas
Inspeção → assinatura quando aplicável
Operação de envio → identidade + conteúdo congelado + recibo
Registro finalizado → eventual correção com motivo e vínculo
Auditoria → quem fez o quê e quando
```

Fotos ficam separadas dos dados relacionais; o registro mantém identidade, relação, tamanho e checksum. Os componentes propostos seguem o prompt mestre: Flutter/Drift no tablet, API .NET, PostgreSQL, painel React e armazenamento separado. Essa visão não cria classes, endpoints, tabelas, migrations ou infraestrutura.

## 10. Decisões abertas para Wagner e a oficina

| ID | Decisão | Proposta / limite atual | Quando precisa estar decidida |
|---|---|---|---|
| D01 | Quem participa e quem dá aceite? | Um tablet; operadores individuais e observador. Mínimo de duas contas individuais para T02.2/T09.4/T10.3; duas pessoas identificadas para validar troca de turno. Sem essas pré-condições, ficam Bloqueados. Nomes e substituto **[CONFIRMAR]** | Antes de executar o piloto |
| D02 | Quem finaliza e quem trata Crítico? | Operador encerra seu registro; Supervisor trata encaminhamento. Autoridade e contingência **[CONFIRMAR]** | Antes de validar fluxo operacional |
| D03 | Checklist real, medições, N/A, evidências e assinatura | Oficina valida itens, unidades, critérios, quando assinar e de quem colher assinatura; exemplos sintéticos não são checklist certificado | Definições de teste antes de T06/T07/T11; checklist operacional antes de uso real |
| D04 | Janela offline | 72 horas vêm da referência técnica anterior. Criação/edição/finalização durante a janela e bloqueios após expirar são **PROPOSTA [CONFIRMAR]** | Antes dos testes de limite de sessão |
| D05 | Conta desativada com trabalho pendente | Preservar dados; responsável decide recuperação autorizada e auditável, sem trocar autoria | Antes de testar desligamento/revogação |
| D06 | Quilometragem inferior, erro ou troca do instrumento | Mostrar divergência e encaminhar; procedimento de exceção **[CONFIRMAR]**, sem inventar leitura | Antes do piloto operacional |
| D07 | Retirada normal versus retirada urgente de checklist | Normal: preservar rascunho iniciado. Urgente: comunicação humana e decisão sobre trabalho offline **[CONFIRMAR]** | Antes de uma retirada urgente |
| D08 | Idioma, termos e acessibilidade | Esboço em português; necessidade de japonês e outros idiomas **[CONFIRMAR]** com operadores | Antes do aceite de uso |
| D09 | Capacidade, fotos e tempo de uso sem rede | Medir volume e tempo; limite operacional e aviso de espaço **[CONFIRMAR]** | Antes dos testes prolongados |
| D10 | Continuidade sem tablet ou servidor | Registro provisório controlado e reconciliação posterior; responsável, identificação e guarda **[CONFIRMAR]** | Antes do piloto |
| D11 | Backup e retenção | Definir procedimento e objetivos mensuráveis do ensaio; frequência, destino e responsáveis definitivos são decisões posteriores. Histórico permanente é intenção do mestre a conciliar com política aprovada | Objetivos/procedimento antes de T18; política definitiva antes de produção |
| D12 | Infraestrutura e distribuição | Endereço de teste alcançável, HTTPS, gestão do tablet e distribuição assinada **[CONFIRMAR]** | Configuração futura, fora desta noite |
| D13 | Metas do piloto | Cinco dias operacionais e vinte inspeções sintéticas são **PROPOSTA**, sem valor estatístico de certificação | Antes de agendar execução |

As dúvidas não bloqueiam a redação do esboço. Bloqueiam a execução ou o aceite do cenário correspondente. Uma decisão registrada não significa que o comportamento já exista no código.

## 11. Piloto proposto e critérios de avanço

**Entrada:** aparelho recebido e identificado; participantes definidos; ambiente e contas de teste preparados em fase posteriormente autorizada; checklist de teste revisado; contingência conhecida; nenhuma credencial ou dado de produção.

**Sequência proposta:** demonstração guiada; inspeção online; inspeção offline; interrupções e retomada; troca de operador; retorno da rede; conferência no painel; correção; ensaio de recuperação; avaliação de conforto. Distribuir vinte inspeções sintéticas por cinco dias é uma proposta que Wagner pode ajustar. A cobertura dos cenários críticos prevalece sobre cumprir uma quantidade.

**Aprovação proposta:** todos os subtestes obrigatórios aplicáveis aprovados com evidência; zero perda de alteração confirmada nas falhas de operação e retomada cobertas (rede, fechamento, reinício e falhas temporárias), exposição entre usuários, reenvio duplicado, alteração de original ou associação ao veículo errado; dados/anexos reconciliados; responsáveis aceitam fluxo, contingência e tempos medidos. Nenhum item crítico fica pendente para declarar aprovação. T18.4 avalia o reconhecimento do limite da perda física de dados nunca enviados e a contingência, sem prometer recuperá-los do servidor.

A família T20 registra o aceite. A amostra de vinte inspeções em cinco dias corresponde à decisão D13 e ao subteste T20.3; permanece proposta, não obrigação aprovada.

**Parada imediata proposta:** perda de trabalho confirmado, acesso indevido, original alterado, veículo trocado ou mensagem de conclusão enganosa. Preservar evidências, registrar o defeito e interromper o cenário afetado; qualquer alteração de código dependerá de autorização futura.

**Não executado ou Bloqueado:** falta do Galaxy, decisão empresarial aberta ou ausência de evidência. Não converter esses estados em aprovação por inferência.

Depois do aceite documental, Wagner decide se autoriza ajustes de programação. Depois da execução física, decide se amplia o piloto. A aprovação de um estágio não autoriza automaticamente produção ou novos equipamentos.

## 12. Entrega desta rodada

Entregar este esboço, a matriz rastreável de 21 famílias e 91 subtestes e o registro da revisão com Claude Code. A matriz inclui evolução do aplicativo/banco e preservação de trabalho pendente durante atualização (T21), sem executar nenhuma atualização. O resultado desta noite é documental: hipóteses claras, decisões abertas, critérios observáveis e roteiro de validação. Os resultados históricos da V1 continuam no relatório anterior, separados da matriz nova que permanece não executada.
