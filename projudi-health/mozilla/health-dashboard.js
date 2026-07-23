/*
 * Painel de saúde do PROJUDI — renderizador tolerante a esquema.
 *
 * Transforma o JSON de /projudi/rest/monitoring/health (ou qualquer endpoint de
 * "health" no estilo Spring Actuator) em um dashboard legível.
 *
 * É um módulo puro: não conhece a origem dos dados. Recebe um objeto JSON já
 * parseado e um elemento container, e desenha. Quem chama (content script da
 * extensão ou a página de preview) cuida de obter o JSON e reagendar refresh.
 *
 * Uso:
 *   HealthDashboard.render(container, dados, {
 *     endpoint: 'https://.../health',
 *     atualizadoEm: new Date(),   // opcional
 *   });
 */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Normalização de status
  // ---------------------------------------------------------------------------

  // Mapeia os muitos rótulos possíveis de status para 4 estados canônicos.
  // Estados: 'good' | 'warning' | 'critical' | 'unknown'
  const STATUS_BOM = new Set(['up', 'ok', 'healthy', 'alive', 'online', 'running', 'ready', 'pass', 'passing', 'true', 'green', 'success', '200']);
  const STATUS_ALERTA = new Set(['warn', 'warning', 'degraded', 'out_of_service', 'partial', 'yellow', 'slow', 'maintenance']);
  const STATUS_CRITICO = new Set(['down', 'error', 'fail', 'failed', 'failing', 'dead', 'offline', 'unhealthy', 'false', 'red', 'critical', 'unavailable', '500', '503']);

  function normalizarStatus(valor) {
    if (valor === true) return 'good';
    if (valor === false) return 'critical';
    if (valor == null) return 'unknown';
    const s = String(valor).trim().toLowerCase();
    if (STATUS_BOM.has(s)) return 'good';
    if (STATUS_ALERTA.has(s)) return 'warning';
    if (STATUS_CRITICO.has(s)) return 'critical';
    return 'unknown';
  }

  const META_STATUS = {
    good:     { rotulo: 'Operacional', icone: '●', simbolo: '✓' },
    warning:  { rotulo: 'Degradado',   icone: '▲', simbolo: '!' },
    critical: { rotulo: 'Indisponível', icone: '■', simbolo: '✕' },
    unknown:  { rotulo: 'Desconhecido', icone: '○', simbolo: '?' },
  };

  // Pega o campo de status de um objeto, seja qual for a capitalização/nome usual.
  function statusBruto(obj) {
    if (obj == null || typeof obj !== 'object') return undefined;
    for (const chave of ['status', 'health', 'state', 'estado', 'situacao', 'situação']) {
      if (chave in obj) return obj[chave];
    }
    return undefined;
  }

  // Agrega o "pior" status de uma lista — usado para derivar o status geral
  // quando o topo não traz um explícito.
  const ORDEM_GRAVIDADE = { critical: 3, warning: 2, unknown: 1, good: 0 };
  function piorStatus(lista) {
    let pior = 'good';
    let viu = false;
    for (const s of lista) {
      if (!s) continue;
      viu = true;
      if (ORDEM_GRAVIDADE[s] > ORDEM_GRAVIDADE[pior]) pior = s;
    }
    return viu ? pior : 'unknown';
  }

  // ---------------------------------------------------------------------------
  // Formatação de valores
  // ---------------------------------------------------------------------------

  function formatarBytes(n) {
    if (typeof n !== 'number' || !isFinite(n)) return String(n);
    if (n === 0) return '0 B';
    const unidades = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.min(Math.floor(Math.log(Math.abs(n)) / Math.log(1024)), unidades.length - 1);
    const v = n / Math.pow(1024, i);
    return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${unidades[i]}`;
  }

  function formatarDuracao(ms) {
    if (typeof ms !== 'number' || !isFinite(ms)) return String(ms);
    if (ms < 1000) return `${Math.round(ms)} ms`;
    let s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600);  s -= h * 3600;
    const m = Math.floor(s / 60);    s -= m * 60;
    const partes = [];
    if (d) partes.push(`${d}d`);
    if (h) partes.push(`${h}h`);
    if (m) partes.push(`${m}min`);
    if (s && partes.length < 2) partes.push(`${s}s`);
    return partes.join(' ') || '0s';
  }

  function formatarNumero(n) {
    return new Intl.NumberFormat('pt-BR').format(n);
  }

  function pareceData(v) {
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(v);
  }

  function formatarData(v) {
    const d = new Date(v);
    if (isNaN(d)) return String(v);
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
  }

  // Heurística: dado o nome do campo, escolhe como exibir o valor.
  function formatarValor(chave, valor) {
    const k = String(chave).toLowerCase();
    if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
    if (valor == null) return '—';
    if (typeof valor === 'number') {
      if (/(byte|bytes|size|tamanho|total|free|livre|used|usado|disk|disco|mem|heap|espaco|espaço)/.test(k) && Math.abs(valor) >= 1024) {
        return formatarBytes(valor);
      }
      if (/(uptime|duration|duracao|duração|elapsed|tempo|latency|latencia|latência)/.test(k) || /(_ms|millis|ms$)/.test(k)) {
        return formatarDuracao(valor);
      }
      if (/(percent|pct|percentual|uso)/.test(k)) return `${valor}%`;
      return formatarNumero(valor);
    }
    if (pareceData(valor)) return formatarData(valor);
    return String(valor);
  }

  function rotularChave(chave) {
    const dic = {
      db: 'Banco de dados', database: 'Banco de dados', datasource: 'Fonte de dados',
      diskspace: 'Espaço em disco', disk: 'Disco', ping: 'Conectividade',
      memory: 'Memória', heap: 'Memória (heap)', cpu: 'CPU', redis: 'Redis',
      total: 'Total', free: 'Livre', used: 'Usado', threshold: 'Limite',
      validationquery: 'Query de validação', version: 'Versão', uptime: 'Tempo no ar',
      timestamp: 'Momento', hostname: 'Servidor', host: 'Servidor', port: 'Porta',
      active: 'Ativas', idle: 'Ociosas', max: 'Máximo', responsetime: 'Tempo de resposta',
    };
    const k = String(chave).toLowerCase().replace(/[_\s-]/g, '');
    return dic[k] || String(chave).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
  }

  // ---------------------------------------------------------------------------
  // Construção de DOM (sem innerHTML de dados externos → sem risco de injeção)
  // ---------------------------------------------------------------------------

  function el(tag, cls, texto) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (texto != null) n.textContent = texto;
    return n;
  }

  // Detecta um par total/livre (ou total/usado) dentro de um objeto de detalhes
  // e, se encontrar, devolve os dados para desenhar uma barra de utilização.
  function detectarUtilizacao(det) {
    if (!det || typeof det !== 'object') return null;
    const num = {};
    for (const [k, v] of Object.entries(det)) {
      if (typeof v === 'number') num[k.toLowerCase()] = v;
    }
    const total = num.total ?? num.max ?? num.capacity;
    let usado = num.used ?? num.usado;
    const livre = num.free ?? num.livre ?? num.available;
    if (total == null) return null;
    if (usado == null && livre != null) usado = total - livre;
    if (usado == null) return null;
    if (total <= 0) return null;
    return { total, usado, pct: Math.max(0, Math.min(100, (usado / total) * 100)) };
  }

  function barraUtilizacao(util) {
    const wrap = el('div', 'hd-meter');
    let estado = 'good';
    if (util.pct >= 90) estado = 'critical';
    else if (util.pct >= 75) estado = 'warning';

    const trilho = el('div', 'hd-meter-track');
    const preenche = el('div', `hd-meter-fill hd-${estado}`);
    preenche.style.width = `${util.pct.toFixed(1)}%`;
    trilho.appendChild(preenche);

    const legenda = el('div', 'hd-meter-legend');
    legenda.appendChild(el('span', 'hd-meter-pct', `${util.pct.toFixed(1)}% em uso`));
    legenda.appendChild(el('span', 'hd-meter-abs', `${formatarBytes(util.usado)} de ${formatarBytes(util.total)}`));

    wrap.appendChild(trilho);
    wrap.appendChild(legenda);
    return wrap;
  }

  // Lista de detalhes chave→valor. Objetos aninhados viram sub-listas.
  // `pular` é um conjunto de chaves (minúsculas) a omitir — usado para não
  // repetir, como texto, os números que já viraram barra de utilização.
  function listaDetalhes(obj, pular) {
    const dl = el('dl', 'hd-details');
    for (const [chave, valor] of Object.entries(obj)) {
      const kl = String(chave).toLowerCase();
      // pula o próprio status (já mostrado no cabeçalho do card)
      if (['status', 'health', 'state', 'estado'].includes(kl)) continue;
      if (pular && pular.has(kl)) continue;
      const linha = el('div', 'hd-detail-row');
      linha.appendChild(el('dt', 'hd-detail-key', rotularChave(chave)));
      const dd = el('dd', 'hd-detail-val');
      if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
        dd.appendChild(listaDetalhes(valor));
      } else if (Array.isArray(valor)) {
        dd.textContent = valor.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ') || '—';
      } else {
        dd.textContent = formatarValor(chave, valor);
      }
      linha.appendChild(dd);
      dl.appendChild(linha);
    }
    return dl;
  }

  function cardComponente(nome, valor) {
    const card = el('section', 'hd-card');

    // Deriva o objeto e o status do componente
    let objeto = valor;
    let stbruto;
    if (valor != null && typeof valor === 'object') {
      stbruto = statusBruto(valor);
      // se não tem status próprio mas tem sub-componentes, agrega
      if (stbruto === undefined && valor.components) {
        stbruto = piorStatus(Object.values(valor.components).map((c) => normalizarStatus(statusBruto(c) ?? c)));
      }
    } else {
      stbruto = valor; // valor escalar direto (ex.: "UP")
      objeto = null;
    }
    const estado = normalizarStatus(stbruto === undefined ? valor : stbruto);
    const meta = META_STATUS[estado];

    const cab = el('header', 'hd-card-head');
    const ponto = el('span', `hd-dot hd-${estado}`);
    ponto.setAttribute('aria-hidden', 'true');
    cab.appendChild(ponto);
    cab.appendChild(el('h3', 'hd-card-title', rotularChave(nome)));
    const badge = el('span', `hd-badge hd-${estado}`);
    badge.appendChild(el('span', 'hd-badge-icon', meta.simbolo));
    badge.appendChild(document.createTextNode(' ' + meta.rotulo));
    cab.appendChild(badge);
    card.appendChild(cab);

    // Detalhes / utilização
    const det = objeto && (objeto.details || objeto.detalhes || (objeto.components ? null : objeto));
    if (det && typeof det === 'object') {
      const util = detectarUtilizacao(det);
      let pular = null;
      if (util) {
        card.appendChild(barraUtilizacao(util));
        // os números que alimentaram a barra não se repetem como texto
        pular = new Set(['total', 'max', 'capacity', 'used', 'usado', 'free', 'livre', 'available']);
      }
      const oculto = ['status', 'health', 'state', 'estado'].concat(pular ? [...pular] : []);
      const temDetalhe = Object.keys(det).some((k) => !oculto.includes(k.toLowerCase()));
      if (temDetalhe) card.appendChild(listaDetalhes(det, pular));
    }

    // Sub-componentes aninhados
    if (objeto && objeto.components && typeof objeto.components === 'object') {
      const sub = el('div', 'hd-subgrid');
      for (const [n, v] of Object.entries(objeto.components)) sub.appendChild(cardComponente(n, v));
      card.appendChild(sub);
    }

    return card;
  }

  // ---------------------------------------------------------------------------
  // Render principal
  // ---------------------------------------------------------------------------

  function render(container, dados, meta) {
    meta = meta || {};
    container.textContent = '';
    container.classList.add('hd-root');

    // Descobre componentes e status geral
    const componentes = (dados && (dados.components || dados.componentes || dados.checks || dados.details)) || null;
    const estadoReportado = normalizarStatus(statusBruto(dados));
    // Estado geral = o pior entre o reportado no topo e o pior componente.
    // Um painel de monitoramento não deve exibir "Operacional" se algo caiu.
    let estadoGeral = estadoReportado;
    if (componentes) {
      const piorComp = piorStatus(Object.values(componentes).map((c) => {
        if (c && typeof c === 'object' && c.components && statusBruto(c) === undefined) {
          return piorStatus(Object.values(c.components).map((x) => normalizarStatus(statusBruto(x) ?? x)));
        }
        return normalizarStatus(statusBruto(c) ?? c);
      }));
      if (estadoGeral === 'unknown') estadoGeral = piorComp;
      else if (ORDEM_GRAVIDADE[piorComp] > ORDEM_GRAVIDADE[estadoGeral]) estadoGeral = piorComp;
    }
    const metaGeral = META_STATUS[estadoGeral];

    // ---- Cabeçalho / hero ----
    const hero = el('header', `hd-hero hd-${estadoGeral}`);
    const heroMain = el('div', 'hd-hero-main');
    heroMain.appendChild(el('div', 'hd-hero-eyebrow', 'PROJUDI · Monitoramento de saúde'));
    const linhaStatus = el('div', 'hd-hero-statusline');
    linhaStatus.appendChild(el('span', `hd-hero-dot hd-${estadoGeral}`));
    linhaStatus.appendChild(el('span', 'hd-hero-status', metaGeral.rotulo));
    heroMain.appendChild(linhaStatus);
    const bruto = statusBruto(dados);
    if (bruto != null) {
      const rebaixado = estadoGeral !== estadoReportado;
      heroMain.appendChild(el('div', 'hd-hero-sub',
        rebaixado
          ? `Servidor reportou "${bruto}", mas há componente(s) com falha`
          : `Status reportado: ${bruto}`));
    }
    hero.appendChild(heroMain);

    // meta lateral (endpoint, atualização)
    const heroMeta = el('div', 'hd-hero-meta');
    if (meta.endpoint) {
      const linha = el('div', 'hd-hero-meta-row');
      linha.appendChild(el('span', 'hd-hero-meta-k', 'Endpoint'));
      linha.appendChild(el('span', 'hd-hero-meta-v hd-mono', meta.endpoint));
      heroMeta.appendChild(linha);
    }
    const carimbo = dados && (dados.timestamp || dados.time || dados.datetime || dados.data);
    if (carimbo) {
      const linha = el('div', 'hd-hero-meta-row');
      linha.appendChild(el('span', 'hd-hero-meta-k', 'Servidor informou'));
      linha.appendChild(el('span', 'hd-hero-meta-v', formatarData(carimbo)));
      heroMeta.appendChild(linha);
    }
    const linhaAtt = el('div', 'hd-hero-meta-row');
    linhaAtt.appendChild(el('span', 'hd-hero-meta-k', 'Atualizado'));
    linhaAtt.appendChild(el('span', 'hd-hero-meta-v', (meta.atualizadoEm || new Date()).toLocaleTimeString('pt-BR')));
    heroMeta.appendChild(linhaAtt);
    hero.appendChild(heroMeta);
    container.appendChild(hero);

    // ---- Barra de resumo (contagem por estado) ----
    if (componentes) {
      const contagem = { good: 0, warning: 0, critical: 0, unknown: 0 };
      for (const c of Object.values(componentes)) {
        const st = normalizarStatus(statusBruto(c) ?? c);
        // se agrega sub-componentes, usa o pior deles
        if (c && typeof c === 'object' && c.components && (statusBruto(c) === undefined)) {
          contagem[piorStatus(Object.values(c.components).map((x) => normalizarStatus(statusBruto(x) ?? x)))]++;
        } else {
          contagem[st]++;
        }
      }
      const resumo = el('div', 'hd-summary');
      const defs = [
        ['good', 'Operacionais'],
        ['warning', 'Degradados'],
        ['critical', 'Indisponíveis'],
        ['unknown', 'Sem status'],
      ];
      for (const [estado, rot] of defs) {
        if (!contagem[estado]) continue;
        const tile = el('div', `hd-summary-tile hd-${estado}`);
        tile.appendChild(el('span', 'hd-summary-num', String(contagem[estado])));
        tile.appendChild(el('span', 'hd-summary-lbl', rot));
        resumo.appendChild(tile);
      }
      container.appendChild(resumo);
    }

    // ---- Grade de componentes ----
    if (componentes && Object.keys(componentes).length) {
      const grade = el('div', 'hd-grid');
      for (const [nome, valor] of Object.entries(componentes)) {
        grade.appendChild(cardComponente(nome, valor));
      }
      container.appendChild(grade);
    } else {
      // Sem "components": renderiza os campos de topo como um único card
      const grade = el('div', 'hd-grid');
      const card = el('section', 'hd-card');
      card.appendChild(el('header', 'hd-card-head', null)).appendChild(el('h3', 'hd-card-title', 'Detalhes'));
      card.appendChild(listaDetalhes(dados || {}));
      grade.appendChild(card);
      container.appendChild(grade);
    }

    // ---- JSON bruto (colapsável) ----
    const raw = el('details', 'hd-raw');
    raw.appendChild(el('summary', 'hd-raw-summary', 'Ver JSON bruto'));
    const pre = el('pre', 'hd-raw-pre');
    pre.textContent = JSON.stringify(dados, null, 2);
    raw.appendChild(pre);
    container.appendChild(raw);

    // rodapé
    const foot = el('footer', 'hd-foot', 'Painel gerado a partir do endpoint de health · leitura apenas.');
    container.appendChild(foot);
  }

  global.HealthDashboard = {
    render,
    normalizarStatus,
    formatarBytes,
    formatarDuracao,
    _internos: { detectarUtilizacao, piorStatus, formatarValor },
  };
})(typeof window !== 'undefined' ? window : this);
