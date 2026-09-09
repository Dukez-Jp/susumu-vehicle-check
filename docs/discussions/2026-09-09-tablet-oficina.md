# Tablet Android para oficina — Codex e Claude Code

Data da pesquisa: 2026-09-09, Japão.
Estado: parecer técnico concluído para uma unidade; orçamento máximo ainda não informado. Nenhuma compra realizada e nenhum modelo foi testado fisicamente nesta análise.

## Pergunta e critérios

Wagner perguntou aos dois agentes qual tablet Android oferece o melhor custo-benefício para a oficina. Foram considerados o projeto SUSUMU VEHICLE CHECK, inspeções perto dos caminhões, tela próxima de 10 polegadas, fotos/QR, caneta ativa, funcionamento offline, proteção física, suporte no Japão e manutenção ao longo dos anos.

Codex pesquisou especificações e preços. Um pesquisador interno do Codex verificou alternativas não Samsung. Claude Code recebeu as evidências e fez três rodadas de análise pelo CLI, na sessão `d8e30939-a147-4b84-9b16-10f5f85f642a`. Claude não realizou pesquisa web própria nessas consultas.

## Preços consultados

Valores com imposto, sem abater pontos de fidelidade. São referências das ofertas consultadas, não garantia do menor preço do mercado nem cotação para compra em volume. Acessórios adicionais e entrega devem ser confirmados para o endereço da empresa.

| Modelo/SKU | Preço com caneta | Conteúdo e origem |
| --- | ---: | --- |
| Samsung Galaxy Tab Active5 Pro Wi-Fi, SM-X350NZGAJ02 | ¥110.070 | S Pen e capa incluídas; [BicCamera](https://www.biccamera.com/bc/item/14180437/). |
| Kyocera KC-T305C + APT301 | ¥79.114 | [Tablet ¥66.422](https://www.askul.co.jp/p/UW19015/) + [caneta ¥12.692](https://www.askul.co.jp/p/JR72229/), Askul. Não inclui eventual capa/suporte adicional. |
| Samsung Galaxy Tab S10 FE Wi-Fi, SM-X520NZSAXJP | ¥86.300 | S Pen incluída; [BicCamera](https://www.biccamera.com/bc/item/13988156/). Capa resistente adicional não cotada. |
| Lenovo Idea Tab, ZAFR0387JP | ¥34.980 | Lenovo Tab Pen incluída; [Lenovo Japão](https://www.lenovo.com/jp/ja/p/tablets/idea-tab-series/lenovo-idea-tab/zafr0387jp). Preço dinâmico verificado pelo pesquisador; o extrator textual retorna principalmente o rodapé. |

A loja oficial Samsung no Yahoo também mostrava o [Active5 Pro por ¥110.000](https://store.shopping.yahoo.co.jp/samsungonline/4986773254313.html), sob encomenda. As condições de pontos são diferentes das da BicCamera.

## Diferenças relevantes

**Active5 Pro:** 10,1 polegadas, 6/128 GB, 680 g; IP68, testes MIL-STD-810H, baterias substituíveis e segurança prevista até 31/05/2033. O teste de queda de até 1,5 m usa a capa fornecida e condições de laboratório. A operação com luvas depende do material e da espessura. [Especificações Samsung](https://www.samsung.com/jp/tablets/others/galaxy-tab-active5-pro-green-128gb-sm-x350nzgaj02/). A garantia japonesa de três anos mencionada pela fabricante cobre falhas naturais conforme suas condições; não equivale a cobertura automática de acidentes. [Samsung Japão](https://news.samsung.com/jp/galaxytabactive5pro-onsale-amazon-electronicsstore).

**Kyocera:** 10,1 polegadas, 4/64 GB sem expansão externa, 520 g; IPX5/IPX8 e IP6X, teste de queda de 75 cm e recursos para luvas. [Especificações Kyocera](https://www.kyocera.co.jp/prdct/telecom/office/phone/lineup/tablet/kc-t305c/). Patches previstos até dezembro de 2029. [Calendário de segurança](https://www.kyocera.co.jp/prdct/telecom/office/phone/security-updates/). A caneta APT301 é vendida separadamente; o anúncio especifica Wacom Generic Protocol. A capacidade local deve ser validada para originais, anotações e vários dias sem rede.

**S10 FE:** 10,9 polegadas, 8/128 GB, 497 g; S Pen, IP68 e segurança prevista até 30/04/2032. É mais leve e oferece mais RAM, mas não foi apresentada evidência de proteção contra quedas equivalente à linha Active. [Samsung Japão](https://www.samsung.com/jp/tablets/galaxy-tab-s/galaxy-tab-s10-fe-silver-128gb-sm-x520nzsaxjp/).

**Idea Tab:** 11 polegadas, 4/128 GB, 480 g, caneta incluída e IP52. A ficha japonesa confirma a classificação IP52; uma avaliação preliminar do pesquisador não havia localizado esse dado e foi corrigida. Não foi localizada certificação de queda equivalente aos modelos empresariais. [Ficha oficial japonesa, páginas 1–2](https://p2-ofp.static.pub/ShareResource/JPCatalog/20250819-lit-web.pdf). A classificação foi confirmada depois da última consulta ao Claude e não foi objeto de nova rodada.

IP e testes de queda são resultados sob condições especificadas pelos fabricantes. Não demonstram resistência universal a produtos químicos ou a qualquer forma de lavagem da oficina.

## Troca com Claude Code

**Rodada 1 — resposta `61267a48-ca77-4c63-9785-6521a2ace5b8`:** Claude preferiu provisoriamente a linha Active para circulação junto aos veículos e sugeriu contabilizar interrupções, reposição de caneta, acessórios e baterias. Sua afirmação de que menos de cinco unidades favoreceria quase sempre o robusto não tinha evidência suficiente.

**Rodada 2 — resposta `29264dc6-000f-4649-9a06-ed475596d949`:** Codex apresentou os preços e especificações dos Samsung, contestou a regra baseada apenas na quantidade e distinguiu preferência técnica de retorno financeiro demonstrado. Claude retirou aquela heurística e manteve a preferência pelo Active para uso móvel. Sugeriu testar uma unidade por duas semanas e cotar peças sobressalentes.

**Rodada 3 — resposta `ff4ac8f5-3524-4d1e-9a9f-5a3b57a5143f`:** Codex apresentou o Kyocera e o candidato econômico Lenovo. Claude manteve o Active para uso móvel por vários anos e reconheceu o Kyocera como alternativa sob um teto próximo de ¥80 mil. Destacou o armazenamento de 64 GB e a janela de suporte menor.

Codex qualifica esse último risco: armazenamento cheio não deve causar perda silenciosa de dados. O sistema deve avisar e controlar novas capturas antes de esgotar o espaço, preservando os dados e fotos ainda não sincronizados, em qualquer modelo.

## Recomendação conjunta e próximo passo

- **Preferido para uso diário móvel por vários anos:** Active5 Pro, se o orçamento comportar aproximadamente ¥110 mil por unidade.
- **Alternativa empresarial de menor desembolso inicial:** Kyocera KC-T305C com APT301, se 64 GB e o suporte até 2029 forem compatíveis com a operação e o piloto.
- **Alternativa de baixo custo para bancada e protótipo:** Lenovo Idea Tab com proteção adicional, sujeito a teste de desempenho e caneta.
- **Meio-termo:** S10 FE para uso mais protegido, quando tela, peso e RAM tiverem maior valor que a resistência física da linha Active.

O Active custa ¥23.770 a mais que o FE na BicCamera, antes de adicionar capa ao FE, e ¥30.956 a mais que o conjunto Kyocera cotado. A diferença não prova economia futura: faltam frequência de falhas, tempo de reparo e custo de indisponibilidade. A tabela oficial de [reparos Samsung](https://www.samsung.com/jp/support/mobile-devices/please-tell-us-about-the-repair-cost-of-the-galaxy-device/) anuncia troca de tela a partir de ¥35.640 para Active5 Pro e ¥25.410 para S10 FE; são preços iniciais de serviço, não seguro nem estimativa de probabilidade de quebra.

Próximo passo sugerido: obter uma unidade para piloto, ou consultar a disponibilidade de demonstração anunciada pela Kyocera. Testar no uso normal a luva real, caneta, conforto, QR/fotos sob a iluminação da oficina, autonomia e volume de arquivos por inspeção. Não foram realizados testes físicos ou contatos com fornecedores. Preço e prazo de reposição da S Pen/baterias Active continuam sem cotação específica.

## Veredito após a confirmação de uma unidade

Wagner confirmou que pretende adquirir somente uma unidade e pediu que os agentes conversem até chegar a um veredito, comunicando o resultado depois. Codex retomou a mesma sessão do Claude para fechar o parecer e transmitiu também a correção da classificação IP52 do Lenovo.

Na resposta `4f69bd37-d26d-452a-a358-e07d42322c71`, Claude declarou:

> Sustento o veredito: **Galaxy Tab Active5 Pro Wi-Fi 128GB, versão japonesa**.

Codex mantém a mesma escolha para o uso móvel descrito no projeto. A justificativa é a combinação de adequação física à oficina, caneta/capa, armazenamento e janela de segurança, não uma prova de que o investimento se paga nem a quantidade isoladamente.

**Parecer conjunto:** recomendar uma unidade do Samsung Galaxy Tab Active5 Pro Wi-Fi 128 GB, SKU japonês SM-X350NZGAJ02, sujeito à compatibilidade do preço com o orçamento de Wagner. A referência de preço já consultada é ¥110.070 na BicCamera.

Claude acrescentou que uma unidade sem reserva deixa o aplicativo indisponível nesse dispositivo durante eventual reparo. Codex registra isso como risco identificado, não como risco já aceito pelo usuário: antes de depender operacionalmente do aplicativo, definir uma forma alternativa de registrar as inspeções. Não há necessidade de alterar a quantidade solicitada para emitir este parecer.

Não restou divergência material entre os agentes sobre a escolha de modelo para o cenário informado. Um teto de orçamento significativamente menor ou uso restrito à bancada pode justificar reabrir a comparação. Teste físico e cotação de sobressalentes permanecem pendentes e não foram apresentados como concluídos.

## Compra confirmada por Wagner

Em 2026-09-09, Wagner informou que já comprou uma unidade do **Samsung Galaxy Tab Active5 Pro (Wi-Fi)**. Em seguida confirmou que **ainda aguarda a entrega**. A escolha do modelo está encerrada para este início do projeto.

Preço pago, vendedor, SKU exato, capacidade da unidade comprada e data de entrega não foram informados. Não presumir que correspondam automaticamente ao anúncio pesquisado. Configuração e testes físicos permanecem pendentes da chegada. O desenvolvimento pode começar no computador com emulador Android.
