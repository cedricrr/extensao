/*
 * Content script — PROJUDI · Painel de Saúde.
 *
 * Roda na página do endpoint de health, que o navegador exibe como JSON cru.
 * Lê esse JSON (mesma origem → sem CORS), substitui a página por um dashboard
 * legível e mantém tudo atualizado automaticamente.
 */
(function () {
  'use strict';

  const INTERVALO_PADRAO = 30; // segundos
  let timer = null;
  let intervalo = INTERVALO_PADRAO;
  let ligado = true;

  // Lê o JSON exibido na própria página (evita uma requisição extra no 1º load).
  function jsonDaPagina() {
    const texto = (document.body && document.body.innerText || '').trim();
    if (!texto) return null;
    try { return JSON.parse(texto); } catch (_) { return null; }
  }

  async function buscarJson() {
    const resp = await fetch(location.href, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }

  function montarLayout() {
    document.title = 'PROJUDI · Saúde do sistema';
    document.body.textContent = '';
    document.body.style.margin = '0';
    document.body.style.background = 'var(--hd-plane, #f9f9f7)';

    const barra = document.createElement('div');
    barra.className = 'hdx-toolbar';

    const titulo = document.createElement('div');
    titulo.className = 'hdx-toolbar-title';
    titulo.textContent = 'PROJUDI · Painel de Saúde';

    const controles = document.createElement('div');
    controles.className = 'hdx-toolbar-controls';

    const btnAtualizar = document.createElement('button');
    btnAtualizar.className = 'hdx-btn';
    btnAtualizar.textContent = 'Atualizar agora';
    btnAtualizar.addEventListener('click', () => atualizar());

    const btnAuto = document.createElement('button');
    btnAuto.className = 'hdx-btn hdx-btn-toggle';
    function pintarAuto() {
      btnAuto.textContent = ligado ? `Auto: ligado (${intervalo}s)` : 'Auto: desligado';
      btnAuto.classList.toggle('hdx-on', ligado);
    }
    btnAuto.addEventListener('click', () => { ligado = !ligado; pintarAuto(); reagendar(); });
    pintarAuto();

    const sel = document.createElement('select');
    sel.className = 'hdx-select';
    for (const s of [10, 30, 60, 120]) {
      const o = document.createElement('option');
      o.value = String(s); o.textContent = `${s}s`;
      if (s === intervalo) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => { intervalo = Number(sel.value); pintarAuto(); reagendar(); });

    controles.append(sel, btnAuto, btnAtualizar);
    barra.append(titulo, controles);

    const container = document.createElement('div');
    container.id = 'hdx-dashboard';

    document.body.append(barra, container);
    return container;
  }

  let container = null;

  function reagendar() {
    if (timer) { clearInterval(timer); timer = null; }
    if (ligado) timer = setInterval(atualizar, intervalo * 1000);
  }

  function mostrarErro(msg) {
    container.textContent = '';
    const box = document.createElement('div');
    box.className = 'hdx-erro';
    box.textContent = `Não foi possível carregar os dados de saúde: ${msg}`;
    container.appendChild(box);
  }

  async function atualizar() {
    try {
      const dados = await buscarJson();
      window.HealthDashboard.render(container, dados, {
        endpoint: location.href,
        atualizadoEm: new Date(),
      });
    } catch (e) {
      mostrarErro(e.message || String(e));
    }
  }

  function iniciar() {
    const inicial = jsonDaPagina();
    container = montarLayout();
    if (inicial) {
      window.HealthDashboard.render(container, inicial, { endpoint: location.href, atualizadoEm: new Date() });
    } else {
      atualizar();
    }
    reagendar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
