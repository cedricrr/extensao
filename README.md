# SEI - Ordenar Marcadores Fornecedor por Data

Extensão de navegador que reordena automaticamente os processos com o marcador **Fornecedor** na tela de Controle de Processos do SEI, exibindo-os em ordem cronológica crescente pelo prazo ("Até DD/MM/AAAA").

## Problema resolvido

Na tela **Controle de Processos** do SEI, os processos são listados na ordem em que foram recebidos ou modificados. Quando vários processos possuem o marcador "Fornecedor" com prazos diferentes, não há como ordená-los por data de vencimento pela interface padrão do sistema. Esta extensão resolve esse problema reordenando esses processos automaticamente ao carregar a página.

## Funcionamento

1. Ao carregar a página de Controle de Processos, a extensão identifica todas as linhas da tabela que possuem o marcador **Fornecedor** com uma data de prazo no formato `Até DD/MM/AAAA`.
2. Essas linhas são reordenadas cronologicamente (do prazo mais próximo para o mais distante), mantendo as demais linhas nas suas posições originais.
3. Um botão **Ordenar "Fornecedor" por data** é adicionado à página para permitir reaplicar a ordenação manualmente, se necessário.

## Compatibilidade

| Versão | Navegador | Pasta |
|---|---|---|
| Chrome / Edge | Manifest V3 | `/` (raiz) |
| Firefox | Manifest V3 + `browser_specific_settings` | `mozilla/` |

## Instalação

### Chrome / Edge

1. Acesse `chrome://extensions/`
2. Ative o **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação**
4. Selecione a pasta raiz do projeto (`sei-auto-prazo/`)

### Firefox (instalação permanente — recomendado)

1. Baixe o arquivo `.xpi` disponível na seção [Releases](../../releases) do repositório
2. No Firefox, abra o arquivo `.xpi` (**Arquivo → Abrir** ou arraste para a janela)
3. Confirme a instalação na caixa de diálogo

A extensão fica instalada permanentemente, inclusive após reiniciar o navegador.

### Firefox (temporário — apenas para testes)

1. Acesse `about:debugging#/runtime/this-firefox`
2. Clique em **Carregar extensão temporária**
3. Selecione o arquivo `mozilla/manifest.json`

> A extensão temporária é removida ao fechar o navegador.

### Como gerar um novo .xpi assinado (mantenedor)

Requer conta no [addons.mozilla.org](https://addons.mozilla.org) com chave de API gerada em **Ferramentas → Gerenciar chaves de API**.

```bash
npm install -g web-ext

web-ext sign \
  --source-dir mozilla/ \
  --api-key=<JWT_issuer> \
  --api-secret=<JWT_secret> \
  --channel=unlisted
```

O `.xpi` assinado é gerado em `web-ext-artifacts/`.

## URL de atuação

A extensão é ativada apenas nas páginas:

```
https://sei.mprr.mp.br/*controlador.php*
```

## Estrutura do projeto

```
sei-auto-prazo/
├── manifest.json        # Manifesto para Chrome/Edge
├── content.js           # Script de conteúdo para Chrome/Edge
└── mozilla/
    ├── manifest.json    # Manifesto para Firefox
    └── content.js       # Script de conteúdo para Firefox
```

---

# PROJUDI — Painel de Saúde (Dashboard)

Extensão de navegador que transforma o endpoint de monitoramento de saúde do PROJUDI —
que o navegador exibe como **JSON cru** — em um **dashboard legível**, com atualização
automática.

Endpoint alvo:

```
https://projudi.tjrr.jus.br/projudi/rest/monitoring/health
```

## O que o painel mostra

- **Status geral** em destaque (Operacional / Degradado / Indisponível), sempre com
  ícone **e** rótulo (a cor nunca carrega o significado sozinha). O cabeçalho reflete o
  **pior** componente — não exibe "Operacional" se algum item caiu.
- **Resumo** com a contagem de componentes por estado.
- **Cards por componente** (banco de dados, disco, memória, conectividade, e-mail, etc.),
  com badge de status e os detalhes formatados de forma amigável:
  - bytes viram `GB`/`MB`, durações viram `2h 15min`, datas ficam no formato brasileiro,
    booleanos viram `Sim`/`Não`;
  - pares *total/livre* ou *total/usado* viram uma **barra de utilização** com o percentual.
- **Ver JSON bruto** — bloco colapsável com o payload original, para quando precisar do dado exato.
- **Atualização automática** (10s / 30s / 60s / 120s) com botão para atualizar na hora.

O renderizador é **tolerante a esquema**: funciona com o formato Spring Actuator
(`status` + `components` + `details`) e também com estruturas genéricas de chave/valor.
Ajuste fino de rótulos e unidades é trivial assim que uma amostra real do JSON estiver disponível.

## Preview sem instalar

Abra `projudi-health/preview.html` no navegador. Ele já vem com dados de exemplo e
oferece **Colar JSON** (para renderizar um retorno real) e **Buscar do endpoint**
(sujeito a bloqueio de CORS quando aberto fora da extensão).

> Capturas de tela: `projudi-health/preview-light.png` e `projudi-health/preview-dark.png`.

## Instalação

### Chrome / Edge
1. Acesse `chrome://extensions/`
2. Ative o **Modo do desenvolvedor**
3. **Carregar sem compactação** → selecione a pasta `projudi-health/`

### Firefox (temporário)
1. Acesse `about:debugging#/runtime/this-firefox`
2. **Carregar extensão temporária** → selecione `projudi-health/mozilla/manifest.json`

## Estrutura

```
projudi-health/
├── manifest.json         # Manifesto Chrome/Edge (MV3)
├── content.js            # Lê o JSON da página e monta a barra + auto-refresh
├── health-dashboard.js   # Renderizador tolerante a esquema (reutilizável)
├── dashboard.css         # Estilos do painel (claro/escuro automático)
├── preview.html          # Preview standalone (dados de exemplo / colar JSON)
└── mozilla/              # Cópia dos arquivos + manifesto para Firefox
```
