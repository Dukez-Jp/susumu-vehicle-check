# Execução e implantação

O repositório contém os componentes e a configuração de implantação. Esta tarefa não autoriza publicar o sistema no VPS ou servidor corporativo; a publicação autorizada é do código no GitHub privado.

DEV começa no computador, com dados sintéticos. Toolchain portátil preparado em `C:\Dev\tools`, ativado nesta máquina por `. 'C:\Dev\tools\SUSUMU-env.ps1'`. Não existe dependência obrigatória desse caminho no CI/Linux; scripts devem aceitar SDKs no PATH.

Docker Compose é o caminho de implantação reproduzível. Use o gerador de variáveis em `scripts/`, examine a configuração, construa os componentes e confira readiness antes de abrir o painel. Não copiar secrets de DEV para staging/produção. Volumes persistentes de PostgreSQL e fotos não podem ser descartados para resolver erro de inicialização.

No Windows atual, Docker/WSL não estava instalado; integração local usa PostgreSQL18 portátil restrito a127.0.0.1. O relatório de entrega separa o que foi testado nessa configuração da execução real de containers.

## Antes de ambiente corporativo

Definir domínio/HTTPS válido, rede/VPN, conta administrativa inicial, papéis/unidades, disco e backup separado. Gerar signing key e credenciais próprias, aplicar migrations com credencial de implantação, criar contas autorizadas e desabilitar fixtures. Confirmar observabilidade sem secrets e testar restore.

O tablet físico usa endereço da rede/HTTPS do servidor de teste, não o `localhost` do computador. Exposição de portas e certificados deve ser planejada; não desabilitar validação TLS para contornar erros.

Cada entrega de APK deve identificar versão/commit e configuração de ambiente. Assinatura de produção depende de uma chave controlada pela empresa; build de depuração não é artefato de publicação definitiva.
