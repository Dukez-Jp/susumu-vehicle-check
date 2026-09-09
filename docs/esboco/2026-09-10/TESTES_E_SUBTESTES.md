# Matriz de testes e subtestes — piloto de um tablet

**Data:** 10/09/2026. **Natureza:** plano documental, sem programação. **Estado de TODOS os subtestes desta matriz: NÃO EXECUTADO.** Nenhum teste de aplicativo, servidor, banco, build ou CI foi disparado para validar este esboço. Resultados históricos não preenchem automaticamente esta matriz.

Referência: [esboço completo](ESBOCO_COMPLETO.md), com telas E01–E10 e decisões D01–D13. Ambiente futuro: um Galaxy Tab Active5 Pro Wi-Fi e um computador autorizado para observar o painel; dados sintéticos. Conta A e conta B são identidades de teste distintas no mesmo tablet, usadas em momentos diferentes; duas pessoas identificadas são necessárias para validar o procedimento operacional de troca de turno, conforme D01.

## Como ler e registrar

São **21 famílias e 91 subtestes planejados**. Cada linha é um subteste independente. `C` significa crítico para integridade, segurança ou continuidade; `F`, funcional; `U`, usabilidade. Esses rótulos priorizam execução, não declaram aprovação.

Pré-condições comuns: configuração de teste posteriormente autorizada, identificadores registrados, contas individuais, checklist sintético conhecido, cópia das respostas/evidências esperadas e observador designado. Nunca induzir falhas apagando dados reais, desligando equipamento de produção ou expondo credenciais. Falhas técnicas que exijam simulação programada ficam planejadas para uma fase autorizada; esta matriz não contém scripts.

Para cada execução futura, registrar: ID; versão do aplicativo e do checklist; aparelho/ambiente; operador e observador; pré-condições; passos realizados; resultado esperado; resultado observado; evidência; data; decisão associada; defeito encontrado; estado e responsável pela revisão. Evidência pode incluir comparação de registros, vídeo autorizado, contagem, checksum ou relatório de recuperação, sem senha/token/dados pessoais desnecessários.

Estados futuros permitidos: **Não executado, Aprovado, Reprovado, Bloqueado**. “Não aplicável” exige justificativa e aprovação do responsável; não serve para dispensar um teste crítico por falta de equipamento ou tempo. Um grupo só pode passar quando todos os seus subtestes obrigatórios aplicáveis tiverem evidência suficiente. Repetições recebem novo registro, sem apagar uma reprovação anterior.

Se uma decisão D01–D13 necessária ao resultado esperado ainda estiver aberta, ou faltar sua pré-condição, o subteste correspondente fica **Bloqueado** quando sua execução for solicitada. Não escolher um resultado de negócio por suposição para conseguir marcar Aprovado.

Quando uma linha contiver variações (por exemplo mínimo, máximo e valores externos em T07.3, ou resposta/foto/assinatura em T08.4), registrar resultado e evidência **para cada variação**. O ID só é aprovado quando todas as variações obrigatórias aplicáveis passarem. Os 91 IDs não representam uma contagem já executada nem limitam o número de execuções futuras.

## T01 — Preparação, login e ambiente

Pré-condição específica: dois ambientes sintéticos identificáveis; políticas de acesso definidas. Telas E01/E02; decisões D01/D12.

| ID | Classe | Ação / condição | Resultado esperado e evidência |
|---|---|---|---|
| T01.1 | F | Entrar pela primeira vez com credencial válida | Conta, unidade e ambiente corretos; registrar identificação exibida sem credencial |
| T01.2 | C | Tentar senha inválida e repetidas tentativas | Sem sessão indevida; orientação de tentativa posterior quando limitada; nenhum segredo no aviso |
| T01.3 | F | Abrir pela primeira vez sem rede e sem catálogo | Informar pré-requisito online; não apresentar frota inventada nem iniciar inspeção sem definição |
| T01.4 | C | Selecionar endereço incorreto, inseguro ou de outro ambiente | Recusar conforme política aprovada; trabalho anterior não é transferido ao outro servidor |

## T02 — Perfis, autoria e unidades

Pré-condição específica: matriz de permissões aprovada, contas com escopos distintos. D01/D02/D05.

| ID | Classe | Ação / condição | Resultado esperado e evidência |
|---|---|---|---|
| T02.1 | C | Conta de inspeção tenta administrar usuários/permissões | Ação recusada, inclusive fora da tela normal em futura verificação técnica; nenhuma alteração |
| T02.2 | C | Conta B procura inspeção/foto privada da conta A ou de outra unidade não autorizada | Sem conteúdo indevido; comparar recurso e escopo antes/depois |
| T02.3 | C | Reduzir permissão enquanto existe sessão online | Operações futuras obedecem permissão vigente; dados confirmados permanecem preservados |
| T02.4 | C | Tentar desativar último administrador ou unidade ainda necessária | Impedimento explícito conforme regras aprovadas; não deixar organização sem administração válida |

## T03 — Cadastros e referências históricas

Pré-condição específica: empresa, unidade, funcionário, veículo e tipo sintéticos. E02/E03; D01.

| ID | Classe | Ação / condição | Resultado esperado e evidência |
|---|---|---|---|
| T03.1 | F | Criar e consultar cadastros permitidos | Campos e vínculos reaparecem corretamente no escopo autorizado |
| T03.2 | C | Repetir número/código que deve ser único, inclusive variação de maiúsculas | Rejeição sem duplicação ou alteração do cadastro anterior |
| T03.3 | C | Desativar tipo/veículo com histórico existente | Histórico preservado; regra para novas associações explícita; não reativar silenciosamente |
| T03.4 | C | Desativar funcionário ligado a uma conta | Cadastro de funcionário e acesso de usuário obedecem decisões separadas; efeito sobre login não é presumido |

## T04 — Identificação do veículo e QR

Pré-condição específica: 714 sintético, segundo cadastro parecido e etiquetas de teste. E02/E03.

| ID | Classe | Ação / condição | Resultado esperado e evidência |
|---|---|---|---|
| T04.1 | F | Pesquisar por número e placa, depois ler QR correspondente | Os três caminhos apresentam a mesma identidade; operador confirma antes de iniciar |
| T04.2 | C | Ler QR válido de outro veículo ou etiqueta trocada | Identificadores ficam evidentes; procedimento de conferência evita associação ao veículo não confirmado |
| T04.3 | F | QR ilegível/desconhecido, câmera sem permissão ou pesquisa sem resultado | Permitir alternativa de pesquisa quando disponível; não inventar correspondência |
| T04.4 | C | Offline, buscar veículo não disponível no catálogo ou inativo conhecido | Informar limitação; não criar inspeção em cadastro substituto por conveniência |

## T05 — Quilometragem

Pré-condição específica: leitura conhecida, veículo novo e procedimento de exceção decidido. E03; D06.

| ID | Classe | Ação / condição | Resultado esperado e evidência |
|---|---|---|---|
| T05.1 | F | Informar leitura igual ou maior que a conhecida; veículo novo com zero | Aceitar valores válidos sem inventar leitura; conferência no detalhe |
| T05.2 | C | Informar vazio, negativo, fração ou texto parcial | Preservar entrada local não concluída quando aplicável; explicar impedimento antes de finalizar |
| T05.3 | C | Informar valor inferior ou salto incompatível com política | Não alterar quilometragem por correção automática; encaminhar conforme D06. Enquanto D06 aberta, subteste Bloqueado |
| T05.4 | C | Enviar inspeção antiga depois de outra com leitura superior | Leitura central não regride; divergência visível e trabalho original preservado |

## T06 — Templates, opções e versões

Pré-condição específica: checklist sintético com status, medição, unidade, opções e duas versões. E03/E04; D03/D07.

| ID | Classe | Ação / condição | Resultado esperado e evidência |
|---|---|---|---|
| T06.1 | F | Definir seções, ordem, opções, obrigatoriedade e assinatura; publicar | Tablet apresenta definição publicada correspondente; opções não aparecem por mera suposição |
| T06.2 | C | Tentar modificar definição já publicada | Versão histórica preservada; mudança requer outra versão |
| T06.3 | C | Abrir rascunho, ficar offline e publicar versão diferente no escritório | Rascunho mantém itens, opções, unidades e versão anteriores, sem conversão silenciosa |
| T06.4 | C | Retirar versão usada em trabalho offline, normalmente e por emergência | Retirada normal preserva trabalho; caso urgente segue D07. Enquanto D07 aberto, subcaso urgente fica bloqueado |

## T07 — Respostas, medições e obrigatoriedade

Pré-condição específica: definição validada pela oficina; limites e unidade conhecidos. E04/E06; D03.

| ID | Classe | Ação / condição | Resultado esperado e evidência |
|---|---|---|---|
| T07.1 | C | Deixar obrigatório sem resposta versus selecionar N/A permitido | Ausência impede finalizar; N/A explícito é resposta somente quando permitido pela versão |
| T07.2 | C | Selecionar status fora das opções ou configuração sem opção válida | Sem remapeamento silencioso; publicação/finalização impedida na etapa apropriada, rascunho preservado |
| T07.3 | F | Medir exatamente no mínimo/máximo e imediatamente além; vazio e N/A | Limites respeitados; unidade mantida; N/A permitido não exige medição inaplicável |
| T07.4 | C | Registrar número decimal parcial, separadores, observação e item Crítico | Entrada visível não é arredondada ou trocada sem regra; Crítico aparece na revisão e segue D02 |

## T08 — Salvamento e interrupção

Pré-condição específica: observador registra quais alterações receberam confirmação de salvamento. E04/E10.

| ID | Classe | Ação / condição | Resultado esperado e evidência |
|---|---|---|---|
| T08.1 | C | Fechar aplicativo após “Salvo no tablet” e reabrir | Todas as alterações confirmadas reaparecem exatamente; comparar respostas e IDs |
| T08.2 | C | Interromper durante digitação antes da confirmação | Não atribuir garantia a texto não confirmado; última versão confirmada preservada e estado honesto |
| T08.3 | C | Reiniciar tablet após salvamento confirmado, com rede ausente | Retomar mesma inspeção e anexos confirmados, sem necessidade de servidor para lê-los no escopo permitido |
| T08.4 | C | Simular falha de capacidade ao salvar resposta, foto ou assinatura | Sem falso “Salvo”; trabalho anterior permanece; falha identificável. Simulação técnica fica para fase autorizada |
| T08.5 | U | Girar tela, alternar seção e teclado, voltar à lista | Sem perda de entrada confirmada, contexto ou associação de anexos |

## T09 — Offline, sessão e troca de operador

Pré-condição específica: política D04 definida e catálogo obtido legitimamente. E01/E02/E10; D04/D05.

| ID | Classe | Ação / condição | Resultado esperado e evidência |
|---|---|---|---|
| T09.1 | C | Desconectar após preparação e percorrer inspeção | Ações autorizadas pela política continuam; ausência de rede não vira perda de rascunho |
| T09.2 | C | Exercitar instante anterior, exato e posterior ao limite offline proposto de 72 h | Criação/edição/finalização seguem D04, dados preservados; sem decisão, teste bloqueado |
| T09.3 | C | Alterar relógio do dispositivo durante sessão de teste | Não prolongar indevidamente autorização; distinguir horário local e recebimento do servidor |
| T09.4 | C | A sai com pendências; B entra; A retorna no mesmo aparelho | B não lê nem envia trabalho de A; A reencontra dados sob autorização válida |
| T09.5 | C | Usuário é desativado enquanto offline, depois reconecta | Servidor recusa nova ação indevida; trabalho permanece para procedimento D05, sem troca automática de autoria. Enquanto D05 aberta, subteste Bloqueado |

## T10 — Captura e recuperação de fotos

Pré-condição específica: fotos sintéticas identificáveis; nenhuma imagem pessoal real. E05/E10.

| ID | Classe | Ação / condição | Resultado esperado e evidência |
|---|---|---|---|
| T10.1 | C | Fotografar item e reabrir a inspeção | Original íntegro, identidade estável e vínculo com item correto |
| T10.2 | C | Interromper captura/retorno do aplicativo e reabrir | Recuperar arquivo já preservado sem duplicar identidade; situação não recuperável fica explícita |
| T10.3 | C | Interromper captura de A e tentar retomar sob B | Evidência de A não aparece a B; recuperação conserva proprietário |
| T10.4 | C | Temporário ausente, mas original já preservado disponível | Recuperar original existente antes de diagnosticar perda do temporário |
| T10.5 | C | Original inacessível por permissão/estrutura; temporário também ausente | Preservar vínculo/journal para diagnóstico; não concluir ausência de original a partir de inacessibilidade |

## T11 — Anotação, S Pen e assinatura

Pré-condição específica: original com checksum registrado; versões com e sem assinatura obrigatória. E05/E06; D03.

| ID | Classe | Ação / condição | Resultado esperado e evidência |
|---|---|---|---|
| T11.1 | C | Desenhar e salvar cópia usando caneta/toque | Original conserva checksum; anotação recebe identidade e vínculo separados |
| T11.2 | C | Cancelar desenho ou falhar ao salvar cópia | Original preservado; cópia inexistente não é apresentada como salva |
| T11.3 | C | Finalizar checklist que exige assinatura com pad vazio e com traço válido | Vazio não é aceito; assinatura válida fica vinculada e salva antes da confirmação |
| T11.4 | C | Criar correção de inspeção assinada | Original e assinatura anterior intactos; nova assinatura exigida quando aplicável, sem reutilização invisível |

## T12 — Finalização e correção

Pré-condição específica: permissões D02 e regras D03/D04 decididas. E06/E07/E09.

| ID | Classe | Ação / condição | Resultado esperado e evidência |
|---|---|---|---|
| T12.1 | C | Finalizar com item, medição ou assinatura obrigatória pendente | Impedimento aponta campo/item; respostas anteriores preservadas |
| T12.2 | C | Finalizar offline com tudo localmente válido | Se permitido por D04, encerrar localmente e mostrar envio pendente; não declarar recebimento no escritório |
| T12.3 | C | Tocar duas vezes na confirmação ou repetir após resposta perdida | Uma finalização lógica; nenhuma duplicação de inspeção ou assinatura |
| T12.4 | C | Tentar editar registro finalizado | Rejeitar alteração invisível; original consultável |
| T12.5 | C | Corrigir registro aceito com motivo e consultar histórico | Novo registro com autor, motivo e vínculo; original, versões e auditoria preservados |

## T13 — Sincronização e repetição

Pré-condição específica: operações sintéticas identificáveis e observação nos dois lados. E08.

| ID | Classe | Ação / condição | Resultado esperado e evidência |
|---|---|---|---|
| T13.1 | C | Voltar ao Wi-Fi após várias alterações offline | Dados elegíveis avançam na ordem correta por inspeção; contagens conciliadas |
| T13.2 | C | Servidor aceita operação, mas resposta não chega; repetir conteúdo idêntico | Recuperar resposta aceita; uma identidade, um efeito e um avanço de versão |
| T13.3 | C | Reutilizar identidade de operação com conteúdo ou dispositivo diferente | Rejeição explícita, sem sobrescrever recibo ou inspeção anterior |
| T13.4 | C | Fazer concorrente concluir entre consulta inicial e gravação de tentativa idêntica | Repetição reconhecida mesmo nessa janela; futuro teste técnico determinístico, não simples aposta em velocidade |
| T13.5 | C | Misturar inspeção rejeitada, outra válida e falhas temporárias do servidor | Preservar rejeitada; outras elegíveis avançam; tentativas não sobrecarregam servidor continuamente |

## T14 — Upload parcial e conclusão

Pré-condição específica: inspeção com vários anexos declarados e assinaturas sintéticas. E05/E08.

| ID | Classe | Ação / condição | Resultado esperado e evidência |
|---|---|---|---|
| T14.1 | C | Interromper rede durante upload e retomar | Arquivo recebido integralmente com checksum correto; sem duplicata por tentativa |
| T14.2 | C | Um anexo falha e os outros estão elegíveis | Outros arquivos avançam; pendência individual permanece identificada |
| T14.3 | C | Finalizar com anexos declarados ainda pendentes e enviá-los depois | Registro final permanece imutável; estado só vira completo quando todos forem confirmados |
| T14.4 | C | Reenviar bytes divergentes para mesmo anexo ou anexar novo ID após finalização | Recusar substituição/anexo não declarado; original e lista final preservados |

## T15 — Conflito e revisão de trabalho

Pré-condição específica: histórico acessível e procedimento de revisão conhecido. E08/E09; D02/D06.

| ID | Classe | Ação / condição | Resultado esperado e evidência |
|---|---|---|---|
| T15.1 | C | Enviar alteração com versão antiga | Conflito explícito; sem escolher silenciosamente última gravação |
| T15.2 | C | Conferir servidor após rejeição ou resposta perdida | Mostrar registro aceito quando existente; não recomendar cópia como se fosse retry idêntico |
| T15.3 | C | Criar cópia de revisão de operação rejeitada | Nova identidade, motivo e referência; conteúdo rejeitado original permanece preservado |
| T15.4 | C | Duas inspeções independentes do mesmo veículo se encontram na sincronização | Não fundir registros automaticamente; leitura conhecida não regride. Pode ser planejado tecnicamente sem segundo tablet físico |

## T16 — Histórico, relatório e auditoria

Pré-condição específica: registros suficientes para mais de uma página, versões e correções. E09 e painel.

| ID | Classe | Ação / condição | Resultado esperado e evidência |
|---|---|---|---|
| T16.1 | F | Consultar registros antigos, carregar mais e voltar offline | Sem linhas duplicadas/perdidas; offline declara cobertura apenas do que está disponível |
| T16.2 | C | Consultar original com correção fora da primeira página recente | Vínculo encontrado por relação correta; ausência na página não prova inexistência de correção |
| T16.3 | C | Gerar relatório/PDF com versões distintas e anexos pendentes | Identificação, autor, unidade, horário, versão, situação dos anexos e correções coerentes com registro |
| T16.4 | C | Comparar auditoria com criação, finalização, correção e administração | Ações críticas têm autor e vínculo; nenhuma edição administrativa reescreve história silenciosamente |

## T17 — Segurança de conteúdo e acesso

Pré-condição específica: amostras artificiais aprovadas, sem conteúdo perigoso real. D01/D12.

| ID | Classe | Ação / condição | Resultado esperado e evidência |
|---|---|---|---|
| T17.1 | C | Enviar tipo/tamanho/conteúdo de imagem inválido ou nome manipulado | Recusa clara; nenhum caminho arbitrário, sobrescrita ou falso anexo completo |
| T17.2 | C | Abrir link de foto sem sessão ou fora do escopo | Acesso recusado; URL não basta como autorização permanente |
| T17.3 | C | Inserir nota sintética com texto interpretável como HTML/fórmula e exportar | Apresentar como dado; não executar conteúdo no painel/planilha |
| T17.4 | C | Revisar mensagens, capturas, documentos e arquivos destinados ao GitHub | Nenhuma senha, token, chave privada ou dado real indevido incluído; registro da revisão sem copiar segredo |

## T18 — Backup, restauração e perda do único tablet

Pré-condição específica: procedimento D10/D11 aprovado; ensaio futuro isolado, sem produção. E10.

| ID | Classe | Ação / condição | Resultado esperado e evidência |
|---|---|---|---|
| T18.1 | C | Restaurar cópia de banco e arquivos em destino isolado | IDs, relações, contagens, tamanhos e checksums conciliados; origem preservada |
| T18.2 | C | Restaurar banco sem parte das fotos | Detectar faltantes; não tratar metadado sozinho como evidência recuperada |
| T18.3 | C | Simular indisponibilidade do único tablet após todos os envios confirmados | Consultar registros no servidor e usar contingência; medir continuidade sem depender de aparelho reserva |
| T18.4 | C | Representar perda física antes do envio em exercício controlado com dados fictícios, sem danificar ou formatar o tablet | Demonstrar e registrar limite: servidor não recupera dado que nunca recebeu; D10 define reconciliação/registro alternativo; este caso não promete recuperação de dado sem cópia externa |
| T18.5 | C | Medir recuperação após falha prolongada e comparar com objetivos D11 | Tempos e perda possível medidos; sem objetivo aprovado, não declarar atendimento de recuperação |

## T19 — Oficina, caneta e conforto

Pré-condição específica: Galaxy recebido; ambiente e uso de luvas autorizados pela oficina. E01–E10; D08/D09.

| ID | Classe | Ação / condição | Resultado esperado e evidência |
|---|---|---|---|
| T19.1 | U | Operar controles com dedo, S Pen e luva usada na oficina | Registrar erros de toque, necessidade de repetir ações e legibilidade; metas aprovadas antes do aceite |
| T19.2 | U | Anotar/assinar com apoio da mão e nas duas orientações | Traços legíveis e ausência de alteração acidental; rejeição de palma deve ser observada, não presumida pelo modelo |
| T19.3 | U | Usar teclado, números, texto, iluminação e posição reais de trabalho | Conteúdo e estados compreensíveis; registrar etapas lentas e termos inadequados |
| T19.4 | U | Percorrer duração de uso acordada, observando bateria, espaço e aquecimento | Medições registradas contra D09; nenhuma promessa de turno completo sem observação no aparelho |

## T20 — Piloto, contingência e aceite

Pré-condição específica: decisões D01–D13 aplicáveis aprovadas e matriz disponível ao observador.

| ID | Classe | Ação / condição | Resultado esperado e evidência |
|---|---|---|---|
| T20.1 | C | Concluir caso feliz completo, do login à conferência no escritório | Mesma inspeção, versão, autor, respostas e anexos; confirmação local/servidor diferenciada |
| T20.2 | C | Exercitar item Crítico e indisponibilidade do único tablet | Responsável e alternativa conhecidos; não confundir encerramento do registro com liberação do veículo |
| T20.3 | F | Distribuir amostra proposta entre operadores, rede e checklists | Cobertura registrada; quantidade/duração não substituem aprovação dos cenários críticos |
| T20.4 | C | Revisar evidências e decidir encerramento do piloto | Sem críticos pendentes; falhas e bloqueios explícitos; aceite assinado pelo responsável definido, sem autorizar expansão automaticamente |

## T21 — Atualização, compatibilidade e estrutura dos dados

Pré-condição específica: versões de origem/destino identificadas, cópia recuperável e autorização futura para ensaio isolado. Não executar migrations, instalar versão nova nem criar teste automatizado nesta fase documental. D11/D12.

| ID | Classe | Ação / condição | Resultado esperado e evidência |
|---|---|---|---|
| T21.1 | C | Preparar estrutura de teste vazia seguindo sequência versionada | Estrutura consistente e versão identificável; sem credencial de produção padrão nem dependência de alteração manual oculta |
| T21.2 | C | Atualizar cópia isolada de dados anteriores com inspeções e referências históricas | Contagens, identidades, relações, versões e anexos preservados; novas regras não reescrevem histórico |
| T21.3 | C | Atualizar aplicativo de teste com rascunho e envios pendentes | Conteúdo confirmado, proprietário, identidades e payload de tentativa já feita permanecem estáveis após atualização |
| T21.4 | C | Interromper atualização em ambiente descartável e exercer procedimento de recuperação aprovado | Falha explícita; recuperação por procedimento verificado, sem presumir que reverter schema sempre seja seguro |
| T21.5 | C | Combinar catálogo em cache/cliente anterior com servidor atualizado | Compatibilidade declarada ou recusa orientada; sem reinterpretar opção antiga, apagar pendência ou declarar sincronização falsa |

## Camadas futuras de verificação

| Camada futura | O que deverá provar | Famílias relacionadas |
|---|---|---|
| Regras isoladas | Obrigatoriedade, opções, limites, identidade e transições | T05–T07, T11–T13 |
| Interface | Estados, mensagens, navegação e preservação de entrada | T01, T04, T07–T12, T19 |
| Persistência local | Retomada, propriedade, confirmação de gravação e falhas | T08–T11, T15 |
| API e banco real | Escopo, concorrência, recibos, imutabilidade, histórico e evolução versionada | T02, T03, T06, T12–T17, T21 |
| Fluxo integrado | Tablet, servidor, anexos e painel reconciliados | T13–T16, T20 |
| Hardware e operação | Caneta, câmera, rede, interrupção, capacidade e contingência | T04, T08–T11, T18–T20 |
| Continuidade | Cópia recuperável, atualização e limites da perda física | T18, T20, T21 |

Nenhuma dessas camadas foi implementada ou executada nesta rodada de esboço. A matriz descreve evidência desejada para uma fase posterior autorizada; não é um relatório de sucesso.

## Resultado documental desta versão

- 21 famílias e 91 subtestes definidos.
- Todos permanecem **NÃO EXECUTADOS** nesta matriz.
- Testes físicos aguardam o único tablet comprado.
- As decisões D01–D13 identificam pré-condições de negócio ainda abertas.
- Programação, execução de testes de software e implantação continuam suspensas nesta fase, conforme a instrução de Wagner.
