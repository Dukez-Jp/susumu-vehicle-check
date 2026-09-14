# Demonstração Tenken no Windows e Chrome

Data: 10/09/2026. Autorização: Wagner pediu uma demonstração navegável, com mouse, antes de continuar o aplicativo Android. Codex e Claude Code real implementaram e revisaram esta etapa. Um Galaxy Tab Active5 Pro Wi-Fi comprado, aguardando entrega.

## Abrir

Neste computador: **http://127.0.0.1:5174/demo.html**.

Para iniciar novamente, dê duplo clique em `C:\Users\Pc Forex 2025\OneDrive - 株式会社ススム\Particular\CODEX\_GPT\ABRIR_DEMO_TENKEN.cmd`. O lançador inicia somente o servidor local da demonstração e abre o Google Chrome. Não é necessário login ou senha. Mantenha o endereço e o mesmo perfil do Chrome para retomar os dados salvos.

Alternativa pelo PowerShell:

```powershell
Set-Location 'C:\Users\Pc Forex 2025\OneDrive - 株式会社ススム\Particular\CODEX\_GPT'
.\scripts\start-tenken-demo.ps1
```

O endereço funciona somente neste PC. O servidor escuta em `127.0.0.1:5174`. Não inicia PostgreSQL, backend, Docker ou migrações. A configuração `vite.demo.config.ts` é independente, sem proxy para a API e com compilação em `dist-demo`. O build normal do painel não inclui esta entrada demonstrativa. O lançador reaproveita uma demonstração já disponível na porta; não encerra processos alheios. Logs e identificação do processo ficam em `.local`, ignorados pelo Git.

## Roteiro para Wagner

1. Em **Minha oficina**, escolha o veículo **714**, **208** ou **431**. São cadastros fictícios.
2. Confira o número e a quilometragem, informe um nome de teste e clique em **Iniciar Tenken**.
3. Percorra os 12 itens nas quatro seções. Marque **OK, Atenção, Reparar, Crítico ou N/A**, quando permitido. Nenhum item começa como OK.
4. Nas medições, digite o valor observado. Vírgula ou ponto decimal são aceitos; o texto original é preservado. A faixa de entrada não determina aprovação mecânica.
5. Escreva observações. Em **Usar imagem de teste**, anexe uma imagem fictícia; em **Anotar cópia**, desenhe com o mouse e salve. A imagem original permanece separada. Também há **Adicionar foto** para JPG/PNG do computador.
6. Volte à oficina ou recarregue a página; retome por **Continuar 714**. Alterações confirmadas são salvas no navegador.
7. Clique em **Revisar inspeção**, confira as pendências e desenhe uma assinatura de teste com o mouse. Esta assinatura é exigida apenas pelo exemplo; a política da oficina continua pendente.
8. Clique em **Finalizar registro**. O histórico fica somente para leitura. **Finalizar não libera o veículo**; ocorrências críticas exigem encaminhamento humano.
9. Abra **Fila de envio**. O controle **Rede de teste** permite simular ausência de rede. **Simular envio** só atua nos registros finalizados e não envia nada para um servidor.
10. Consulte o **Histórico**, abra o relatório e use **Imprimir relatório** ou **Exportar dados (JSON)**, se desejar.

## O que funciona e o que é simulação

| Comportamento | Nesta demonstração |
|---|---|
| Cliques, navegação e respostas | Funcionais no Chrome |
| Rascunho, recarga e histórico | Persistência real em localStorage, neste perfil/endereço |
| Fotos e assinatura | Imagens locais embutidas; anotações em cópia com proporção preservada |
| Finalização | Valida respostas, medições e assinatura; só confirma após gravação |
| Falha de gravação | Aviso visível, edição em memória preservada, exportação e nova tentativa; não anuncia salvo |
| Foto que excede capacidade | Recusada antes de incorporá-la ao rascunho; imagem original externa permanece intacta |
| Outra aba modificou os dados | Detecta divergência antes da gravação e pede preservar/exportar a cópia; use uma única aba |
| Identidade e permissões | Operador de teste, sem autenticação real ou isolamento por usuário |
| Rede e envio | Simulados e identificados; não há API, recibo ou sincronização real |
| QR, câmera e S Pen | Não demonstrados como hardware real; seleção manual, arquivo e mouse |
| Odômetro do cadastro | Base sintética fixa; não avança com as inspeções desta demo |
| Android offline e durabilidade | Não homologados por esta demonstração de navegador |

Use somente dados de teste. O armazenamento do Chrome tem cota; arquivos individuais têm limite de 1 MB e a demonstração limita o estado com fotos a 1.500.000 caracteres antes de aceitar anexos. Não há compressão destrutiva dos originais. Uma falha real de cota ainda é tratada, inclusive quando espaço é ocupado por outros dados. Dados corrompidos, versão desconhecida ou veículo fora do catálogo geram aviso de recuperação e não são apagados automaticamente. Use uma aba; a verificação de divergência não transforma localStorage em banco transacional entre abas.

Limpar dados do navegador/perfil remove esta demonstração. Exportar JSON permite guardar uma cópia, mas não há importação/restauração implementada aqui. O botão de rede não desliga o Wi-Fi do computador. Sem servidor local rodando, reabrir a página não funciona; isto não é um teste do funcionamento offline do Android.

## Validação desta entrega

Os testes desta demonstração são separados dos 91 subtestes planejados do piloto. Não preencher a matriz anterior como aprovada por causa desta entrega.

- Testes automatizados do modelo: 15 casos, incluindo respostas vazias, zero/valores negativos, vírgula decimal, N/A, assinatura, imutabilidade da finalizada, reload, falha de cota, dados corrompidos e vínculos de fotos.
- Testes automatizados da interface: 10 casos, incluindo retomada, bloqueio de finalização, falha de gravação, recuperação de dados desconhecidos, outra aba e recusa de foto sem alterar rascunho.
- Regressão do painel: 47 testes existentes.
- Verificação manual automatizada pelo controle do Chrome: veículo 714, todos os cinco status, medição `1,0`, observação, reload, 12 respostas, imagem sintética, anotação com mouse, assinatura com mouse, finalização, bloqueio do envio simulado sem rede e histórico após envio simulado.
- O upload automatizado por seletor de arquivo foi bloqueado pela permissão da extensão Chrome (`Allow access to file URLs`); esse caminho não é declarado validado no navegador. A imagem embutida permitiu validar visualmente a anotação sem alterar permissões da extensão.
- Tablet físico, câmera, S Pen, impressão física, regras empresariais e produção seguem sem aceite nesta etapa.

O parecer conjunto e os comandos finais executados constam em [REVISAO_DEMO_TENKEN.md](REVISAO_DEMO_TENKEN.md).
