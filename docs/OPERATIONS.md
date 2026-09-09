# Operação e continuidade

## Rotina

Verificar readiness da API, espaço em disco no servidor/tablet, filas e fotos pendentes, erros de autenticação e última execução/restauração de backup. Inspeções finalizadas com anexos pendentes ainda exigem acompanhamento.

Em queda de Wi-Fi, continuar somente após o aplicativo confirmar salvamento local. Não limpar dados/desinstalar o app com pendências. Em troca de conta, preservar o trabalho do autor original. Em conflito, conservar registros e usar fluxo de correção documentado; nunca editar banco diretamente para forçar sincronização.

## Backup

Backup consistente deve incluir banco, fotos e manifesto. Para a primeira versão com arquivos em volume, interromper novas escritas durante o ponto de cópia conforme os scripts, retomar o serviço e verificar o backup. Destino separado do servidor e controle de acesso são decisões de implantação.

Restauração usa banco e diretório novos. Conferir checksums, vínculos de fotos, login, histórico e exemplo de relatório antes de substituir qualquer ambiente existente. Scripts não devem executar DROP/clean sobre destinos arbitrários.

## Incidentes

- Rede/servidor indisponível: preservar fila, observar erro e restabelecer conexão.
- Token expirado: autenticar novamente como o mesmo autor antes de sync.
- Tablet perdido: revogar conta/dispositivo conforme capacidade implantada, proteger acesso e registrar última sincronização conhecida.
- Disco cheio: interromper novas capturas, recuperar capacidade sem apagar originais pendentes.
- Divergência de dados: reunir IDs de inspeção/operação e auditoria, sem expor tokens.

Há somente um tablet comprado. Definir registro alternativo de inspeção durante reparo/indisponibilidade e procedimento de reconciliação posterior. Não presumir compra de unidade reserva.

Produção exige responsáveis por contas, manutenção do servidor, backup, checklist e aprovação de revisões. Essas responsabilidades de negócio não são inventadas pelo software.
