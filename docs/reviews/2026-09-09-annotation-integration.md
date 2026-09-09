# Integração Android: anotação já enviada antes da finalização

O runner real `tests/integration/run-local.ps1` passou pelos17 cenários HTTP iniciais, mas o teste Dart/Drift/sync retornou409 ao finalizar uma inspeção após enviar original e cópia anotada. A mensagem era `was declared as Annotation and cannot become Original`.

`items[].photoIds` informa IDs e associação ao item; não contém tipo de foto. A API criava placeholders Original e o upload os resolvia para Annotation. No sync seguinte, a repetição dos mesmos IDs era tratada indevidamente como tentativa de reclassificar a anotação.

A correção em `InspectionSyncService` preserva uma Annotation existente quando a declaração continua sendo foto do mesmo item. Não altera Kind, OriginalPhotoId, bytes nem vínculos. Mudança de item, IDs de outra inspeção, conversão assinatura/foto e reupload com metadados divergentes continuam proibidos.

Evidência de regressão: `AnnotationSyncRegressionTests` teve2 falhas esperadas por409 antes da alteração e4/4 casos aprovados depois, executados pelo coordenador com output isolado em `.local/annotation-build`. Cobre draft e finalização após uploads, finalização antes dos uploads, replay e proteção de vínculos. A repetição do runner real e o CI ainda precisam constar do relatório final; este registro não os substitui.