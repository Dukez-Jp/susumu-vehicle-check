# Amostras públicas oficiais do MLIT

Baixadas sem alteração em 10/09/2026 para testar somente a importação do arquivo
exportado pelo aplicativo oficial. São dados públicos de demonstração do MLIT,
não veículos ou pessoas cadastrados pela SUSUMU. Não comprovam leitura física NFC
nem acesso à API.

Página de origem: https://www.denshishakensho-portal.mlit.go.jp/business/application/

Arquivos em `https://www.denshishakensho-portal.mlit.go.jp/assets/files/`:

- `sample01.json`: registrado, motocicleta sem número de classificação.
- `sample02.json`: registrado, caminhão e observações extensas.
- `sample03.json`: registrado, formulário A e caracteres japoneses especiais.
- `sample04.json`: registrado, formulário B e caracteres japoneses especiais.
- `K_sample01.json`: kei, caso 1.
- `K_sample02.json`: kei sem número de classificação.
- `K_sample03.json`: kei com caracteres japoneses especiais.

Especificação pública conferida: `Vehicle_Inspection_Certificate_Information_Intake_File_Specifications.pdf`,
versão 3.34, aplicada em 06/09/2026, no mesmo diretório oficial.
Essa versão documental difere de `CertInfoImportFileVersion: "1.0"` no JSON.

O parser guarda somente os campos do cadastro necessários. Nomes de proprietários,
endereços e observações presentes nas amostras não são incluídos no resultado.
