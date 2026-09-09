# Revisão conjunta da demonstração Tenken

Data: 10/09/2026. Demonstração local Windows/Chrome autorizada por Wagner, com dados sintéticos e mouse. Escopo independente da implementação Android e da matriz anterior de 91 subtestes do piloto.

## Colaboração comprovada

Claude Code real, CLI autenticada, sessão `9cc4c49e-ffb9-4d57-a5a5-e8348a0b712c`, implementou `admin-web/src/demo/model.ts` e seus testes. Codex implementou a interface, desenho, entrada independente, lançador, testes de interação e integração. Houve três rodadas: implementação com crítica arquitetural, correção do modelo e revisão da UI, verificação final das correções em leitura apenas. Os arquivos JSON das respostas estão em `.local/claude-demo-{model,review,final}.json`, privados e ignorados pelo Git; não são necessários para executar a demonstração.

O veredito final de Claude foi **“Pronto para avaliação do Wagner”**, sem bloqueador remanescente nos arquivos revisados. Claude distinguiu os testes de domínio executados por ele dos testes da interface e da observação no Chrome executados por Codex; não declarou ter operado o navegador.

## Ajustes resultantes da discussão

- Medição de sulco pode ser zero ou abaixo de uma faixa de condição mecânica. Limites de entrada de teste não são diagnóstico. Aceitar decimal com vírgula preservando o texto digitado, rejeitando separadores ambíguos.
- Validar vínculo da anotação com a foto original do mesmo item; recusar duplicidades e anotações órfãs.
- Veículo desconhecido nos dados guardados mostra recuperação com preservação, evitando tela branca.
- Gravação da finalização e dos anexos precisa ser confirmada antes de aceitar o novo estado. Anexo recusado não deixa o rascunho preso com imagem que nunca coube no armazenamento.
- Limite agregado antes de anexar foto, aviso de cota real, exportação da edição em memória e tentativa de salvar. Limite individual harmonizado para 1 MB depois da observação final do Claude.
- Desenho da cópia mantém proporção; o original permanece intacto. Alvo da anotação é capturado explicitamente, e clique duplo no mesmo salvamento não cria duas cópias.
- Rótulo de navegação é “Voltar à oficina”; salvamento é automático e informado separadamente.
- Detecção de gravação divergente por outra aba evita sobrescrita conhecida. A demo continua exigindo uso em uma aba, sem promessa de transação distribuída.
- A compilação da demonstração é separada da compilação do painel; não altera API, migrações ou aplicativo Android.

## Verificação executada por Codex

| Verificação | Resultado |
|---|---|
| `npm.cmd test` em admin-web | 72 testes aprovados: 15 do modelo demo, 10 da UI demo, 47 existentes |
| `npm.cmd run lint` | Aprovado, zero avisos |
| `npm.cmd run build:demo` | TypeScript e bundle demo aprovados |
| `npm.cmd run build` | Build do painel existente aprovado; entrada demo ausente de dist |
| Prettier nos arquivos demo | Aprovado |
| Lançador PowerShell | Partida a frio e reaproveitamento do servidor conferidos; URL respondendo |
| Chrome real | Seleção714, 12respostas, cinco status, vírgula decimal, nota, reload, imagem sintética, anotação e assinatura com mouse, finalização, fila e histórico |

Testes de interação foram escritos antes da UI completa. Falhas de regressão observadas antes das correções cobriram finalização recusada por armazenamento, gravação de outra aba, veículo desconhecido e foto recusada que permanecia indevidamente em memória. A matriz do piloto anterior permanece sem execução.

## Limites

Envio e conectividade são simulações explícitas, identidade é de teste, não há QR/câmera/S Pen físicos, autenticação empresarial ou teste de durabilidade Android nesta rodada. A importação/restauração do JSON exportado não foi implementada. A automação do seletor de arquivo foi recusada pela permissão da extensão Chrome, e não foi contornada; a imagem embutida foi usada no teste de anotações. Não houve alteração de permissões da extensão, publicação em produção, compra ou acesso a dados reais. GitHub serve para versionamento privado da demonstração, em branch própria, sem merge em main.
