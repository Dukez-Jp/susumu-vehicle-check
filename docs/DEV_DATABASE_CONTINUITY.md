# Continuidade do banco de demonstração inicial

Em 2026-09-09, a primeira API DEV foi iniciada enquanto o backend ainda estava sendo escrito. Ela aplicou `20260909134309_InitialSchema`. Antes de o código ser publicado, o autor regenerou a migration inicial como `20260909134508_InitialSchema`. No primeiro reinício integrado, a API recusou inicialização com `42P07: relation audit_log already exists`; não houve alegação de sucesso nem alteração manual do histórico de migrations.

Foi conferido em leitura que esse banco continha somente o fixture sintético inicial: 4 usuários, 3 veículos, 0 inspeções, 0 fotos e nenhum outro cliente conectado. Com a API parada, o coordenador criou um dump protegido e preservou integralmente o banco como `susumu_dev_initial_20260909144229`. O inventário após a mudança de nome coincidiu com o anterior. Nada foi descartado.

Um banco vazio `susumu_dev` foi criado no mesmo cluster DEV loopback127.0.0.1:55432, recebeu as migrations definitivas e o seed sintético. As credenciais de administração local permaneceram sob o mesmo arquivo privado. Esse ambiente passou depois pelos17 cenários HTTP iniciais; as extensões posteriores são avaliadas no relatório final.

Evidência privada, não versionada: `.local/initial-demo-archive.json` e `.local/susumu_dev_initial_20260909144229.dump`. SHA256 do dump: `04E02F75F4195B3AB4C1691F10D29E96E307C9045ABEEFB51DA5B8C7FB21B7E0`.

Essa foi uma recuperação de fixture anterior à publicação, exclusivamente DEV. Não é um procedimento de upgrade de produção. Depois de publicada/aplicada uma migration, mudanças de schema exigem uma nova migration, preservando as anteriores. O teste de atualização e o de restauração da entrega usam o banco definitivo com inspeções e fotos reais do fluxo sintético.