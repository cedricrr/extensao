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
