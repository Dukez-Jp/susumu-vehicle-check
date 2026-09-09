# ADR-004 — Fotos originais e anotações

Data: 2026-09-09. Decisão: adotada.

Bytes de fotos são armazenados fora do PostgreSQL, em diretório/volume persistente, com uma interface que permita futuro armazenamento de objetos. Banco guarda IDs, relações, tipos, tamanhos e checksums. Diretório não é servido publicamente: download passa pela autorização da API.

Cada original é imutável. Desenho com S Pen/toque gera novo arquivo de anotação vinculado ao original. Reenvio com mesmos ID e checksum é idempotente; mesmo ID com bytes diferentes deve ser rejeitado.

O cliente grava o arquivo local antes de confirmar sua referência como salva, usando arquivo temporário e renomeação no mesmo volume quando aplicável. Servidor valida JPEG/PNG, assinatura do arquivo, tamanho máximo15MiB e checksum; nomes e caminhos são derivados de IDs internos. Upload temporário não deve sobrescrever objeto existente.

Finalização congela a lista de anexos declarados. Seus bytes podem chegar depois; a interface informa pendência. A mesma regra vale para eventual assinatura, tratada como anexo separado quando habilitada. Dados de fotos de produção nunca entram no Git.
