# Backend com HTTPS no servidor do escritório — plano de implementação

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** Colocar o backend do SUSUMU Vehicle Check no ar no servidor do escritório (`hayashida2andar`) com certificado HTTPS válido, alcançável pelo Galaxy Tab Active5 Pro através do Tailscale, e publicar o checklist oficial de 100 itens do 点検整備記録簿 (livro de registro de inspeção e manutenção) para que o aplicativo Flutter execute inspeções reais.

**Arquitetura:** A API .NET 10 e o PostgreSQL 18 rodam em `hayashida2andar` por Docker Compose, escutando apenas em `127.0.0.1`. O **Tailscale Serve** termina o TLS com certificado Let's Encrypt válido no nome `<host>.<tailnet>.ts.net` e encaminha para o Caddy local. **Nenhuma porta é aberta no roteador.** O tablet entra na mesma tailnet e recebe essa origem no campo "Servidor HTTPS" do aplicativo. O catálogo de 100 itens vira dois `ChecklistTemplate` publicados pela API.

**Pilha:** .NET 10 / EF Core, PostgreSQL 18.6, Docker Compose, Caddy 2, Tailscale, Flutter (cliente), Python 3.11+ (script de publicação).

**Especificação:** `docs/IMPLEMENTATION_CONTRACT.md`, `AGENTS.md`, `infrastructure/README.md`, `docs/DEPLOYMENT.md`, `docs/PRIMEIRO_USO.md`.

---

## Restrições globais

Copiadas literalmente da especificação. Valem para **todas** as tarefas.

- Nunca commitar direto na `main`. Sempre branch novo e pull request.
- Nunca usar `--force` nem `--force-with-lease` em push.
- Antes de commitar, rodar `git status` e **parar** diante de qualquer linha `deleted:` não pretendida.
- `.local/` contém segredos e fica fora do Git. Segredos nunca são impressos, registrados em log nem commitados.
- Somente dados sintéticos em fixtures DEV. Não inventar UUID de hardware, limites legais, leituras nem aprovações.
- O formulário impresso sai sempre no layout japonês original. Nenhuma regra nova dentro de `@media print`.
- Versões publicadas de template são **imutáveis**; publicar cria uma nova versão. A versão exata fica fixada em cada inspeção.
- `SUSUMU_DEV_SEED` deve ficar `false` em qualquer ambiente que não seja DEV descartável.
- A implantação HTTPS **não pode reusar** o nome de projeto Compose nem os volumes de dados do DEV.
- Não desabilitar validação TLS para contornar erro de certificado.
- Chave de assinatura JWT com no mínimo 32 bytes, vinda de variável de ambiente. Sem credencial padrão.
- Cada entrega de APK identifica versão e commit. Build de depuração não é artefato de publicação definitiva.

---

## Realidade de acesso — leia antes de tudo

Verificado em 14/09/2026 a partir do computador de casa:

| Fato | Consequência para o plano |
|---|---|
| `\\hayashida2andar\Servidor` responde, com leitura e escrita | Posso preparar arquivos no servidor |
| `\\hayashida2andar\c$` → **Permissão negada** | Não alcanço o disco do sistema |
| Não há execução remota (sem SSH, sem WinRM configurado) | **Não consigo instalar nem iniciar nada no servidor** |
| `.local/` do servidor tem só logs da demonstração | O backend **nunca rodou lá**; tudo é provisionamento novo |
| Tailscale ativo e **direto**: `100.71.77.65`, RTT 28ms | A base de rede já existe e funciona |

**Portanto:** toda tarefa marcada **[SERVIDOR]** precisa ser executada por Wagner no próprio servidor — presencialmente ou por Área de Trabalho Remota. Eu preparo cada arquivo e cada comando exato; a execução é sua. Tarefas marcadas **[AQUI]** eu executo.

---

## Decisão de arquitetura: Tailscale Serve, não Caddy ACME

O repositório já traz `infrastructure/Caddyfile.https` e `compose.https.yaml`, que usam ACME (Let's Encrypt) direto. **Este plano não os usa.** Motivo:

ACME por HTTP-01 exige as portas 80 e 443 **abertas da internet** para o servidor, mais um domínio público apontando para o IP do escritório. Esse servidor é o arquivo geral da empresa — tem contratos, PDFs, painéis do Digitako. Expô-lo à internet para obter um certificado é risco desproporcional ao ganho.

O Tailscale Serve resolve o mesmo problema sem nenhuma porta aberta: provisiona certificado Let's Encrypt válido para `<host>.<tailnet>.ts.net`, e **só dispositivos da tailnet alcançam**. O tablet entra na tailnet, e pronto. Sem DNS para configurar, sem porta exposta, sem certificado autoassinado — e o aplicativo exige certificado válido, que é exatamente o que se obtém.

Os arquivos `Caddyfile.https` / `compose.https.yaml` permanecem no repositório, intocados, para um cenário futuro de domínio corporativo real.

---

## Achado que muda o escopo: falta o 日常点検

O catálogo `catalogo_pdf_100_itens.json` foi extraído do 点検整備記録簿 (livro de registro de inspeção e manutenção) da 全日本トラック協会 (Associação Japonesa de Transporte Rodoviário). Analisando a periodicidade impressa:

| Periodicidade | Itens |
|---|---|
| `[3, 12]` — trimestral **e** anual | 51 |
| `[12]` — somente anual | 49 |
| **Total** | **100** |

Ou seja, esse PDF cobre o **3か月点検 (inspeção trimestral)** e o **12か月点検 (inspeção anual)**. O **日常点検 (inspeção diária)**, que você citou como um dos três objetivos do app, **não está neste catálogo** — é uma lista legal separada e bem mais curta, com seu próprio formulário.

Consequência: este plano entrega dois templates (trimestral e anual). O template da inspeção diária exige uma fonte oficial que ainda não está no repositório. **Tarefa 11** trata disso, e é a única que depende de material que você precisa fornecer.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Estado |
|---|---|---|
| `scripts/publish_tenken_templates.py` | Converte o catálogo em dois `ChecklistTemplate` e publica pela API | **criar** |
| `scripts/tests/test_publish_tenken_templates.py` | Testes da conversão, sem rede | **criar** |
| `infrastructure/compose.tailscale.yaml` | Sobreposição Compose para o ambiente do escritório | **criar** |
| `infrastructure/Caddyfile.tailscale` | Caddy escutando em HTTP local, TLS fica com o Tailscale | **criar** |
| `docs/OPERACAO_SERVIDOR_ESCRITORIO.md` | Runbook: subir, parar, backup, diagnóstico | **criar** |
| `docs/source/tenken-20260910/catalogo_pdf_100_itens.json` | Fonte dos itens | existe, **não alterar** |
| `compose.yaml` | Base DEV | existe, **não alterar** |
| `infrastructure/Caddyfile.https` | Cenário de domínio público futuro | existe, **não alterar** |

Todo o trabalho acontece no branch `feature/backend-https-servidor-2026-09-14`.

---

## Tarefa 0 — Reconhecimento do servidor **[SERVIDOR]**

Sem isto o resto é adivinhação. Nada é instalado nesta tarefa.

**Interfaces — Produz:** os fatos que decidem a Tarefa 1 (Docker ou nativo).

- [ ] **Passo 1: Coletar o estado do servidor**

Na Área de Trabalho Remota do `hayashida2andar`, em PowerShell:

```powershell
"=== Windows ==="
(Get-CimInstance Win32_OperatingSystem).Caption
(Get-CimInstance Win32_OperatingSystem).Version

"=== Docker ==="
if (Get-Command docker -ErrorAction SilentlyContinue) { docker version --format '{{.Server.Version}}' } else { 'AUSENTE' }

"=== WSL ==="
wsl --status 2>&1 | Select-Object -First 3

"=== Tailscale ==="
& 'C:\Program Files\Tailscale\tailscale.exe' version
& 'C:\Program Files\Tailscale\tailscale.exe' status --json | ConvertFrom-Json | Select-Object -ExpandProperty MagicDNSSuffix

"=== Portas 80/443/5432 em uso ==="
Get-NetTCPListener -LocalPort 80,443,5432 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,OwningProcess

"=== Disco livre ==="
Get-PSDrive C | Select-Object @{n='LivreGB';e={[math]::Round($_.Free/1GB,1)}}

"=== Ferramentas portáteis ==="
Test-Path 'C:\Dev\tools\SUSUMU-env.ps1'

"=== Memoria ==="
[math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1GB,1)
```

- [ ] **Passo 2: Me enviar a saída**

Cole o resultado inteiro. **Esperado que importa:** o sufixo MagicDNS (algo como `tailnet-XXXX.ts.net`) e se Docker está presente. Se as portas 80/443 já estiverem ocupadas por outro serviço do escritório, dizemos isso agora e não no meio da subida.

---

## Tarefa 1 — Escolher o runtime **[AQUI]**

**Interfaces — Consome:** saída da Tarefa 0. **Produz:** a decisão que orienta as Tarefas 3 e 4.

- [ ] **Passo 1: Aplicar a regra de decisão**

| Situação na Tarefa 0 | Caminho |
|---|---|
| Docker Engine presente e funcional | **Compose** — reproduzível, é o caminho documentado |
| Sem Docker, mas ≥ 8 GB RAM e Windows 11/Server 2022+ | Instalar Docker Desktop (Tarefa 2b) e seguir Compose |
| Sem Docker e instalação não autorizada | **Nativo**: PostgreSQL 18 portátil + API publicada como serviço |

O caminho Compose é o preferido: os volumes nomeados, o healthcheck do banco e o `backup` com perfil `tools` já estão escritos e validados em configuração. O nativo existe como plano B e custa um runbook próprio.

- [ ] **Passo 2: Registrar a decisão**

Criar `decisions/2026-09-14-runtime-servidor-escritorio.md` com a escolha, a razão e o que foi descartado. É exigência do `AGENTS.md`: decisões arquiteturais vão para `decisions/`.

---

## Tarefa 2 — Habilitar certificados HTTPS na tailnet **[SERVIDOR / painel web]**

Sem isto o Tailscale Serve não consegue emitir certificado e a Tarefa 5 falha.

- [ ] **Passo 1: Ligar MagicDNS e HTTPS**

Em <https://login.tailscale.com/admin/dns>:
1. **MagicDNS** → Enable.
2. **HTTPS Certificates** → Enable.

- [ ] **Passo 2: Confirmar o nome completo do servidor**

No servidor:

```powershell
& 'C:\Program Files\Tailscale\tailscale.exe' cert --help
& 'C:\Program Files\Tailscale\tailscale.exe' status --json | ConvertFrom-Json | Select-Object -ExpandProperty CertDomains
```

Esperado: uma lista com pelo menos `hayashida2andar.<sufixo>.ts.net`. **Se vier vazia**, HTTPS Certificates não está realmente habilitado — voltar ao passo 1. Não prosseguir sem esse nome.

- [ ] **Passo 3: Anotar o nome**

Esse valor é o `PUBLIC_HOST` das tarefas seguintes e a origem que vai no campo "Servidor HTTPS" do tablet. Anote-o; ele não é segredo.

---

## Tarefa 3 — Provisionar a cópia de trabalho e os segredos no servidor **[SERVIDOR]**

**Interfaces — Produz:** `.env` e `.local/dev-credentials.json` protegidos, no diretório do servidor.

- [ ] **Passo 1: Preparar o diretório**

O servidor já tem o clone em `C:\Servidor\susumu-vehicle-check`. Atualizar:

```powershell
Set-Location C:\Servidor\susumu-vehicle-check
git switch main
git pull
```

- [ ] **Passo 2: Proteger `.local` antes de qualquer segredo**

```powershell
./scripts/protect-private-paths.ps1
```

Esperado: conclusão sem erro. O script bloqueia acesso herdado amplo e recusa junções/links. **Se falhar, parar** — o `infrastructure/README.md` é explícito: falha de ACL interrompe a criação de segredos.

- [ ] **Passo 3: Gerar as variáveis de ambiente**

```powershell
python scripts/generate_dev_env.py
```

Esperado: cria `.env` e `.local/dev-credentials.json`, **sem imprimir valor nenhum**. Senhas de 24 bytes aleatórios, chave de assinatura de 48. O gerador **se recusa a substituir** arquivo existente — se já existir, isso é informação, não erro a contornar.

- [ ] **Passo 4: Conferir sem expor**

```powershell
(Get-Content .env | Measure-Object -Line).Lines
(Get-Content .env) -replace '=.*','=<oculto>'
```

Esperado: as chaves `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `JWT_SIGNING_KEY` presentes, valores nunca exibidos.

---

## Tarefa 4 — Subir a pilha em loopback **[SERVIDOR]**

Antes de expor qualquer coisa, provar que funciona localmente.

**Interfaces — Consome:** `.env` da Tarefa 3. **Produz:** API respondendo em `127.0.0.1:8080`.

- [ ] **Passo 1: Criar a sobreposição do escritório**

Criar `infrastructure/compose.tailscale.yaml`:

```yaml
# Ambiente do escritorio. TLS fica a cargo do Tailscale Serve;
# o Caddy escuta apenas em HTTP no loopback.
services:
  api:
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      Database__ApplyMigrationsAtStartup: 'false'
      SUSUMU_DEV_SEED: 'false'
      SUSUMU_BOOTSTRAP_ADMIN_PASSWORD: ''
  web:
    ports: !override
      - '127.0.0.1:8080:80'
```

Note o `SUSUMU_DEV_SEED: 'false'` e o `SUSUMU_BOOTSTRAP_ADMIN_PASSWORD` vazio: contas reais são criadas na Tarefa 8, não semeadas.

- [ ] **Passo 2: Validar a configuração antes de subir**

```powershell
docker compose -p susumu-oficina -f compose.yaml -f infrastructure/compose.tailscale.yaml config
```

Esperado: YAML resolvido impresso, sem erro. Nome de projeto `susumu-oficina` — **distinto** do DEV, como manda a restrição global.

- [ ] **Passo 3: Aplicar migrations com credencial de implantação**

A sobreposição desliga `ApplyMigrationsAtStartup`. Aplicar explicitamente:

```powershell
docker compose -p susumu-oficina -f compose.yaml -f infrastructure/compose.tailscale.yaml up -d db
docker compose -p susumu-oficina -f compose.yaml -f infrastructure/compose.tailscale.yaml run --rm api dotnet ef database update
```

Esperado: migrations aplicadas, sem erro. **Se falhar**, não subir a API; diagnosticar com `docker compose -p susumu-oficina logs db`.

- [ ] **Passo 4: Subir tudo**

```powershell
docker compose -p susumu-oficina -f compose.yaml -f infrastructure/compose.tailscale.yaml up --build -d
docker compose -p susumu-oficina ps
```

Esperado: `db`, `api` e `web` com status `running`, `db` marcado `healthy`.

- [ ] **Passo 5: Provar prontidão**

```powershell
curl.exe -sS http://127.0.0.1:8080/api/v1/health/ready
curl.exe -sS -o NUL -w "%{http_code}`n" http://127.0.0.1:8080/api/v1/health/live
```

Esperado: corpo indicando pronto e HTTP `200`. **Se vier 503**, o banco não está alcançável — ver logs da API antes de seguir. Não prosseguir para a Tarefa 5 sem 200 aqui.

---

## Tarefa 5 — Expor por HTTPS com Tailscale Serve **[SERVIDOR]**

**Interfaces — Consome:** API em `127.0.0.1:8080` (Tarefa 4) e o nome `.ts.net` (Tarefa 2).

- [ ] **Passo 1: Publicar**

```powershell
& 'C:\Program Files\Tailscale\tailscale.exe' serve --bg --https=443 http://127.0.0.1:8080
& 'C:\Program Files\Tailscale\tailscale.exe' serve status
```

Esperado: o status mostra `https://hayashida2andar.<sufixo>.ts.net` encaminhando para `http://127.0.0.1:8080`.

A primeira requisição HTTPS provoca a emissão do certificado e pode demorar alguns segundos.

- [ ] **Passo 2: Verificar de OUTRO dispositivo da tailnet**

Este passo **não vale se rodado no próprio servidor** — testar de fora é o ponto. Do computador de casa:

```bash
curl -sS https://hayashida2andar.<sufixo>.ts.net/api/v1/health/ready
curl -sS -o /dev/null -w "%{http_code} %{ssl_verify_result}\n" https://hayashida2andar.<sufixo>.ts.net/api/v1/health/live
```

Esperado: corpo de prontidão, `200` e `ssl_verify_result` **igual a 0** (certificado validado sem nenhuma flag de exceção). Se precisar de `-k` para funcionar, **o certificado não está válido e a tarefa falhou** — o aplicativo vai recusar do mesmo jeito.

- [ ] **Passo 3: Confirmar que nada foi aberto na internet**

De uma rede fora da tailnet (dados móveis, com Tailscale desligado):

```bash
curl -sS --max-time 10 https://hayashida2andar.<sufixo>.ts.net/api/v1/health/live
```

Esperado: **falha de conexão ou tempo esgotado**. Esse é o resultado correto e desejado. Se responder, a exposição está mais ampla do que se pretende — parar e revisar.

- [ ] **Passo 4: Garantir sobrevivência a reinício**

`tailscale serve --bg` persiste a configuração. Confirmar reiniciando o servidor e repetindo o Passo 2. Um servidor de oficina reinicia por queda de energia; isso não pode exigir intervenção manual.

---

## Tarefa 6 — Converter o catálogo em templates **[AQUI]**

Primeira tarefa de código. TDD de verdade: teste falhando, implementação mínima, teste passando.

**Arquivos:**
- Criar: `scripts/publish_tenken_templates.py`
- Testar: `scripts/tests/test_publish_tenken_templates.py`

**Interfaces — Produz:**
- `build_templates(catalog: dict) -> list[dict]` — retorna dois dicionários no formato `TemplateWriteRequest`, o trimestral primeiro.
- `SECTION_ORDER_KEY` — a chave estável usada para ordenar seções.

- [ ] **Passo 1: Escrever o teste falhando**

`scripts/tests/test_publish_tenken_templates.py`:

```python
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).parents[2]
spec = importlib.util.spec_from_file_location(
    'publish_tenken_templates', Path(__file__).parents[1] / 'publish_tenken_templates.py'
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

CATALOG = json.loads(
    (ROOT / 'docs/source/tenken-20260910/catalogo_pdf_100_itens.json').read_text(encoding='utf-8')
)


class BuildTemplatesTests(unittest.TestCase):
    def test_produces_quarterly_and_annual_templates(self):
        quarterly, annual = module.build_templates(CATALOG)
        self.assertEqual(quarterly['name'], '3か月点検')
        self.assertEqual(annual['name'], '12か月点検')

    def test_item_counts_match_the_printed_legend(self):
        quarterly, annual = module.build_templates(CATALOG)
        self.assertEqual(sum(len(s['items']) for s in quarterly['sections']), 51)
        self.assertEqual(sum(len(s['items']) for s in annual['sections']), 100)

    def test_every_item_keeps_its_pdf_identity(self):
        _, annual = module.build_templates(CATALOG)
        ids = [i['id'] for s in annual['sections'] for i in s['items']]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertTrue(all(i.startswith('pdf-') for i in ids))

    def test_sections_follow_document_order_without_duplicates(self):
        _, annual = module.build_templates(CATALOG)
        titles = [s['title'] for s in annual['sections']]
        self.assertEqual(len(titles), len(set(titles)))
        self.assertEqual(titles[0], 'ハンドル')

    def test_labels_are_the_japanese_source_text_unchanged(self):
        _, annual = module.build_templates(CATALOG)
        labels = {i['id']: i['label'] for s in annual['sections'] for i in s['items']}
        self.assertEqual(labels['pdf-004'], '緩み、がた及び損傷(※1)')

    def test_all_items_are_status_type_and_required(self):
        _, annual = module.build_templates(CATALOG)
        for section in annual['sections']:
            for item in section['items']:
                self.assertEqual(item['responseType'], 'status')
                self.assertTrue(item['required'])


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Passo 2: Rodar o teste e confirmar que falha**

```powershell
python -m unittest scripts.tests.test_publish_tenken_templates -v
```

Esperado: **FAIL** com `FileNotFoundError` ou `No module named 'publish_tenken_templates'`, porque o arquivo ainda não existe.

- [ ] **Passo 3: Implementação mínima**

`scripts/publish_tenken_templates.py`:

```python
"""Converte o catalogo oficial do 点検整備記録簿 em ChecklistTemplate.

Nao inventa itens, periodicidade nem limites: tudo vem do catalogo extraido
do PDF da 全日本トラック協会. A periodicidade e a transcrita da legenda
impressa, no campo periodsMonthsFromPrintedLegend.
"""

SECTION_ORDER_KEY = 'componentJa'

VEHICLE_TYPE = 'Truck'


def _sections_for(items):
    """Agrupa por componente preservando a ordem do documento."""
    order = []
    grouped = {}
    for item in items:
        title = item[SECTION_ORDER_KEY]
        if title not in grouped:
            grouped[title] = []
            order.append(title)
        grouped[title].append(
            {
                'id': item['id'],
                'label': item['sourceText'],
                'responseType': 'status',
                'required': True,
            }
        )
    return [{'id': title, 'title': title, 'items': grouped[title]} for title in order]


def build_templates(catalog):
    """Retorna [trimestral, anual] no formato TemplateWriteRequest."""
    items = catalog['items']
    quarterly_items = [
        i for i in items if 3 in (i.get('periodsMonthsFromPrintedLegend') or [])
    ]
    return [
        {
            'name': '3か月点検',
            'vehicleType': VEHICLE_TYPE,
            'sections': _sections_for(quarterly_items),
        },
        {
            'name': '12か月点検',
            'vehicleType': VEHICLE_TYPE,
            'sections': _sections_for(items),
        },
    ]
```

- [ ] **Passo 4: Rodar o teste e confirmar que passa**

```powershell
python -m unittest scripts.tests.test_publish_tenken_templates -v
```

Esperado: **6 testes, OK**. Em especial `51` e `100` batendo com a legenda impressa.

- [ ] **Passo 5: Commit**

```bash
git add scripts/publish_tenken_templates.py scripts/tests/test_publish_tenken_templates.py
git commit -m "feat(scripts): converter catalogo do tenken em templates trimestral e anual"
```

---

## Tarefa 7 — Publicar os templates pela API **[SERVIDOR]**

**Interfaces — Consome:** `build_templates` da Tarefa 6, API da Tarefa 5.

- [ ] **Passo 1: Estender o script com a publicação**

Acrescentar a `scripts/publish_tenken_templates.py` uma função `publish(base_url, token, template)` que faz `POST /api/v1/templates` e, com o `id` retornado, `POST /api/v1/templates/{id}/publish`. O token vem de variável de ambiente, **nunca de argumento de linha de comando** — argumentos aparecem na lista de processos.

- [ ] **Passo 2: Teste do caminho de erro, sem rede**

Acrescentar ao arquivo de teste:

```python
class PublishSafetyTests(unittest.TestCase):
    def test_refuses_plain_http(self):
        with self.assertRaisesRegex(ValueError, 'HTTPS'):
            module.publish('http://exemplo/', 'token', {})

    def test_refuses_missing_token(self):
        with self.assertRaisesRegex(ValueError, 'token'):
            module.publish('https://exemplo/', '', {})
```

Rodar, ver falhar, implementar as duas guardas, rodar e ver passar.

- [ ] **Passo 3: Publicar de fato**

```powershell
$env:SUSUMU_API_TOKEN = '<token do login administrativo>'
python scripts/publish_tenken_templates.py --base-url https://hayashida2andar.<sufixo>.ts.net
Remove-Item Env:\SUSUMU_API_TOKEN
```

- [ ] **Passo 4: Verificar pelo contrato, não pela mensagem do script**

```powershell
curl.exe -sS -H "Authorization: Bearer $token" https://hayashida2andar.<sufixo>.ts.net/api/v1/templates
```

Esperado: dois templates, `published: true`, um com 51 itens somados e outro com 100. Conferir também que `GET /api/v1/bootstrap` os devolve — é de lá que o tablet lê.

---

## Tarefa 8 — Criar contas e veículos reais **[SERVIDOR]**

- [ ] **Passo 1: Conferir que a semeadura DEV está desligada**

```powershell
docker compose -p susumu-oficina exec api printenv SUSUMU_DEV_SEED
```

Esperado: `false`. Se vier `true`, parar: o veículo sintético 714 não pode entrar num ambiente de uso real.

- [ ] **Passo 2: Criar a unidade e as contas**

Pelo painel administrativo ou por `POST /api/v1/users`, criar: um `Administrator`, um `Supervisor` e uma conta `Inspector` por mecânico. Papéis exatos conforme o contrato: `Administrator`, `Supervisor`, `Inspector`, `Office`.

- [ ] **Passo 3: Cadastrar os caminhões**

`POST /api/v1/vehicles` com número interno, placa, tipo `Truck` e quilometragem atual. Este é o momento do 車検証閲覧アプリ (aplicativo oficial de leitura do certificado eletrônico): é cadastro por veículo, uma vez, não rotina diária — exatamente como sua pesquisa concluiu.

- [ ] **Passo 4: Verificar o escopo**

Entrar com a conta de um mecânico e confirmar que ele vê apenas os veículos da sua unidade, e que `GET /api/v1/bootstrap` traz os dois templates publicados.

---

## Tarefa 9 — Tablet: instalar e validar em uso real **[TABLET, com o aparelho em mãos]**

- [ ] **Passo 1: Entrar na tailnet**

Instalar o Tailscale pela Google Play no tablet e autenticar na mesma tailnet. Confirmar que `https://hayashida2andar.<sufixo>.ts.net/api/v1/health/live` abre no Chrome do tablet **com cadeado**, sem aviso de certificado.

- [ ] **Passo 2: Instalar o APK**

```powershell
. C:\Dev\tools\SUSUMU-env.ps1
adb devices -l            # o tablet precisa aparecer
adb install -r "C:\Dev\susumu-vehicle-check\mobile\build\app\outputs\flutter-apk\app-debug.apk"
```

APK atual: SHA1 `542e6b27f2257fc16c95bafa79ebc9372ca2f8da`, 178,0 MB, `jp.susumu.susumu_vehicle_check` 1.0.0, mínimo API 24, alvo 36, com `arm64-v8a`.

- [ ] **Passo 3: Primeiro login online**

No campo "Servidor HTTPS", informar **somente a origem**: `https://hayashida2andar.<sufixo>.ts.net` — **sem** `/api/v1`, que a API acrescenta internamente. Entrar com a conta de um mecânico. Esperado: veículos e os dois templates baixados.

- [ ] **Passo 4: Uma inspeção completa de ponta a ponta**

Escolher um caminhão, iniciar o 3か月点検, responder itens, tirar foto, anotar com a S Pen, assinar, finalizar. Esperado: "Salvo no tablet" a cada etapa e a inspeção aparecendo no painel do escritório depois de sincronizar.

- [ ] **Passo 5: O teste que só este tablet permite — troca de bateria a quente**

Com uma inspeção em rascunho e o "Salvo no tablet" exibido, **trocar a bateria a quente**. Reabrir o app. Esperado: o rascunho intacto, com todas as respostas. Este é o requisito que descartou o Capacitor; é obrigatório comprovar, não presumir.

- [ ] **Passo 6: Perda de rede no meio do envio**

Iniciar a sincronização e desligar o Wi-Fi no meio. Esperado: a fila mostra pendência explícita, sem perda e sem falso "tudo sincronizado"; ao voltar a rede, completa sozinha.

---

## Tarefa 10 — Backup antes do uso real **[SERVIDOR]**

Sem backup testado, não há uso real. Esta tarefa não é opcional.

- [ ] **Passo 1: Primeiro backup**

```powershell
docker compose -p susumu-oficina --profile tools run --rm --build backup `
  backup --output /backups/oficina-20260914 --environment Production --writers-stopped
```

- [ ] **Passo 2: Conferir o manifesto**

Esperado: `sha256.json` presente, cobrindo `database.dump`, `photos.tar.gz` e `metadata.json`. **Sem o manifesto final, a pasta está incompleta** e não conta como backup.

- [ ] **Passo 3: Ensaio de restauração para alvo novo**

```powershell
docker compose -p susumu-oficina --profile tools run --rm backup `
  restore --bundle /backups/oficina-20260914 `
  --target-database susumu_restore_20260914 `
  --target-photos /backups/restore-20260914/photos `
  --environment RestoreValidation
```

Esperado: restauração num banco **novo** e diretório de fotos **inexistente**. Alvos existentes são recusados por projeto — isso é proteção, não defeito. Conferir contagem de registros e SHA-256 das fotos.

- [ ] **Passo 4: Agendar**

Tarefa Agendada do Windows rodando o backup diariamente fora do horário da oficina, com destino **fora do disco do servidor**. Backup no mesmo disco não sobrevive à falha desse disco.

---

## Tarefa 11 — 日常点検 (inspeção diária) **[depende de material seu]**

A única tarefa bloqueada por algo que não está no repositório.

- [ ] **Passo 1: Fornecer a fonte oficial**

O 日常点検 tem formulário legal próprio, não presente no catálogo de 100 itens. Preciso do PDF ou formulário oficial que a ススムサービス usa.

- [ ] **Passo 2: Inventariar como foi feito com o outro**

Mesmo tratamento do `docs/source/tenken-20260910/`: original imutável, SHA-256 registrado, catálogo extraído com rastreabilidade item a item. Sem transcrever de memória e sem inventar item nenhum — a restrição global vale aqui com força total.

- [ ] **Passo 3: Reusar a Tarefa 6**

`build_templates` ganha o terceiro template. Os testes ganham a contagem real de itens vinda do inventário.

---

## Revisão do plano

**Cobertura:** o objetivo pedido — backend no ar com HTTPS válido no servidor do escritório — é coberto pelas Tarefas 0 a 5. A publicação do checklist, pelas 6 a 8. A validação no tablet, pela 9. A 10 protege o que passou a existir. A 11 registra a lacuna do 日常点検 em vez de escondê-la.

**Consistência de tipos:** `build_templates(catalog) -> [quarterly, annual]` é definida na Tarefa 6 e consumida na 7 com esse nome e essa ordem. `SECTION_ORDER_KEY` é usada só internamente. O formato de saída segue `TemplateWriteRequest` do `docs/IMPLEMENTATION_CONTRACT.md`: `{name, vehicleType, sections:[{id,title,items:[{id,label,responseType,required}]}]}`.

**Riscos assumidos e declarados:**

1. **O APK é de depuração**, assinado com chave de desenvolvimento. Serve para o piloto com os mecânicos; distribuição corporativa assinada é etapa separada, não coberta aqui.
2. **O desenho bento continua só no app web.** A escolha do caminho (D) mantém a aparência atual do Flutter. Portar o visual é trabalho posterior e não bloqueia o piloto.
3. **Depender do Tailscale significa que, sem ele, o tablet não sincroniza.** O trabalho offline continua por até 72h após o login online, então uma queda não para a oficina — mas a sincronização espera a volta.
4. **A Tarefa 0 pode invalidar o caminho Compose.** Se o servidor não puder receber Docker, a Tarefa 1 desvia para o nativo e as Tarefas 4, 7 e 10 ganham comandos diferentes. Isso é conhecido e está previsto, não é surpresa.
