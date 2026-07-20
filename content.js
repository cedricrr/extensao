(function () {
  'use strict';

  const NOME_MARCADOR = 'Fornecedor';
  const REGEX_DATA = /Até\s+(\d{2})\/(\d{2})\/(\d{4})/i;

  function extrairData(ariaLabel) {
    const m = ariaLabel && ariaLabel.match(REGEX_DATA);
    if (!m) return null;
    const [, dd, mm, yyyy] = m;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  }

  function dataDoMarcador(tr) {
    const marcadores = tr.querySelectorAll('a.ancMarcador');
    for (const anc of marcadores) {
      if (anc.textContent.trim() === NOME_MARCADOR) {
        const data = extrairData(anc.getAttribute('aria-label'));
        if (data) return data;
      }
    }
    return null;
  }

  function ordenarTabela() {
    const tabela = document.querySelector('table.tabelaControle');
    if (!tabela || !tabela.tBodies.length) return;

    const tbody = tabela.tBodies[0];

    // Coleta as linhas com marcador "Fornecedor" na ordem em que aparecem.
    const alvo = [];
    for (const tr of Array.from(tbody.rows)) {
      const data = dataDoMarcador(tr);
      if (data) alvo.push({ tr, data });
    }
    if (alvo.length < 2) return;

    // Substitui cada linha por um comentário-placeholder fixo no DOM,
    // garantindo que as posições originais dos slots fiquem preservadas.
    const placeholders = alvo.map(({ tr }) => {
      const ph = document.createComment('slot-fornecedor');
      tbody.insertBefore(ph, tr);
      tbody.removeChild(tr);
      return ph;
    });

    // Ordena as linhas por data crescente (mais antiga → mais recente).
    const ordenadas = alvo.slice().sort((a, b) => a.data - b.data);

    // Cada placeholder recebe a linha ordenada correspondente.
    placeholders.forEach((ph, i) => {
      tbody.replaceChild(ordenadas[i].tr, ph);
    });
  }

  function inserirBotao() {
    const alvo = document.querySelector('h1') && document.querySelector('h1').parentElement;
    if (!alvo || document.getElementById('btnOrdenarFornecedores')) return;

    const botao = document.createElement('button');
    botao.id = 'btnOrdenarFornecedores';
    botao.textContent = 'Ordenar "Fornecedores" por data';
    botao.style.margin = '8px 0';
    botao.style.cursor = 'pointer';
    botao.addEventListener('click', ordenarTabela);
    alvo.appendChild(botao);
  }

  // document_idle garante que o DOM já está pronto quando o script é injetado.
  inserirBotao();
  ordenarTabela();
})();