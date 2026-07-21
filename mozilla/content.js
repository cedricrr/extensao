(function () {
  'use strict';

  const REGEX_DATA = /Até\s+(\d{2})\/(\d{2})\/(\d{4})/i;
  const BADGE_CLASS = 'sei-prazo-badge';

  function extrairData(ariaLabel) {
    const m = ariaLabel && ariaLabel.match(REGEX_DATA);
    if (!m) return null;
    const [, dd, mm, yyyy] = m;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  }

  function marcadorComData(tr) {
    for (const anc of tr.querySelectorAll('a.ancMarcador')) {
      const data = extrairData(anc.getAttribute('aria-label'));
      if (data) return { anc, data };
    }
    return null;
  }

  function calcularDias(data) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return Math.round((data - hoje) / (1000 * 60 * 60 * 24));
  }

  function textoBadge(dias) {
    if (dias < 0) return `vencido há ${Math.abs(dias)} dia${Math.abs(dias) !== 1 ? 's' : ''}`;
    if (dias === 0) return 'vence hoje';
    if (dias === 1) return 'vence em 1 dia';
    return `vence em ${dias} dias`;
  }

  function corBadge(dias) {
    if (dias < 0)  return '#c0392b'; // vencido   → vermelho
    if (dias <= 3) return '#e67e22'; // 0–3 dias  → laranja
    if (dias <= 7) return '#f39c12'; // 4–7 dias  → amarelo
    return '#27ae60';                // 8+ dias   → verde
  }

  function inserirBadge(anc, data) {
    // Evita duplicação: remove badge anterior imediatamente após este marcador
    if (anc.nextElementSibling && anc.nextElementSibling.classList.contains(BADGE_CLASS)) {
      anc.nextElementSibling.remove();
    }
    const dias = calcularDias(data);
    const span = document.createElement('span');
    span.className = BADGE_CLASS;
    span.textContent = textoBadge(dias);
    span.style.cssText = [
      'display:inline-block',
      'margin-left:6px',
      'padding:1px 7px',
      'border-radius:10px',
      `background:${corBadge(dias)}`,
      'color:#fff',
      'font-size:0.78em',
      'font-weight:bold',
      'vertical-align:middle',
      'white-space:nowrap',
    ].join(';');
    anc.insertAdjacentElement('afterend', span);
  }

  function ordenarTabela() {
    const tabela = document.querySelector('table.tabelaControle');
    if (!tabela || !tabela.tBodies.length) return;

    const tbody = tabela.tBodies[0];

    const alvo = [];
    for (const tr of Array.from(tbody.rows)) {
      const resultado = marcadorComData(tr);
      if (resultado) alvo.push({ tr, ...resultado });
    }

    if (alvo.length === 0) return;

    // Insere/atualiza badges em todas as linhas com prazo
    for (const { anc, data } of alvo) {
      inserirBadge(anc, data);
    }

    if (alvo.length < 2) return;

    // Ordena as linhas por data crescente usando comment-placeholders
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
