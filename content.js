(function () {
  'use strict';

  const REGEX_DATA = /Até\s+(\d{2})\/(\d{2})\/(\d{4})/i;

  function extrairData(ariaLabel) {
    const m = ariaLabel && ariaLabel.match(REGEX_DATA);
    if (!m) return null;
    const [, dd, mm, yyyy] = m;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  }

  function dataDoMarcador(tr) {
    for (const anc of tr.querySelectorAll('a.ancMarcador')) {
      const data = extrairData(anc.getAttribute('aria-label'));
      if (data) return data;
    }
    return null;
  }

  function ordenarTabela() {
    const tabela = document.querySelector('table.tabelaControle');
    if (!tabela || !tabela.tBodies.length) return;

    const tbody = tabela.tBodies[0];

    const alvo = [];
    for (const tr of Array.from(tbody.rows)) {
      const data = dataDoMarcador(tr);
      if (data) alvo.push({ tr, data });
    }
    if (alvo.length < 2) return;

    const placeholders = alvo.map(({ tr }) => {
      const ph = document.createComment('slot-prazo');
      tbody.insertBefore(ph, tr);
      tbody.removeChild(tr);
      return ph;
    });

    const ordenadas = alvo.slice().sort((a, b) => a.data - b.data);

    placeholders.forEach((ph, i) => {
      tbody.replaceChild(ordenadas[i].tr, ph);
    });
  }

  function inserirBotao() {
    const alvo = document.querySelector('h1') && document.querySelector('h1').parentElement;
    if (!alvo || document.getElementById('btnOrdenarPorPrazo')) return;

    const botao = document.createElement('button');
    botao.id = 'btnOrdenarPorPrazo';
    botao.textContent = 'Ordenar por prazo "Até"';
    botao.style.margin = '8px 0';
    botao.style.cursor = 'pointer';
    botao.addEventListener('click', ordenarTabela);
    alvo.appendChild(botao);
  }

  // document_idle garante que o DOM já está pronto quando o script é injetado.
  inserirBotao();
  ordenarTabela();
})();
