// ===== TOAST =====
function showToast(msg, tipo = 'sucesso') {
  const icons = { sucesso: '✅', erro: '❌', info: 'ℹ️' };
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.innerHTML = `<span>${icons[tipo]}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 0.4s';
    el.style.opacity    = '0';
    setTimeout(() => el.remove(), 400);
  }, 3200);
}

// ===== BADGE CARRINHO =====
function atualizarBadgeCarrinho() {
  const total = getCarrinho().reduce((s, i) => s + i.qtd, 0);
  document.querySelectorAll('.badge-carrinho').forEach(b => { b.textContent = total; });
}

// ===== MENU MOBILE =====
function initMenuMobile() {
  const toggle = document.getElementById('menuToggle');
  const nav    = document.getElementById('navMenu');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', () => nav.classList.toggle('aberto'));
  document.addEventListener('click', e => {
    if (!toggle.contains(e.target) && !nav.contains(e.target)) nav.classList.remove('aberto');
  });
}

// ===== FORMATADORES =====
function formatarPreco(val) {
  return 'R$ ' + Number(val).toFixed(2).replace('.', ',');
}
function formatarData(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function formatarDataCurta(iso) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

// ===== GRUPOS =====
const GRUPOS_NOMES = {
  A: 'Grupo A', B: 'Grupo B', C: 'Grupo C', D: 'Grupo D',
  E: 'Grupo E', F: 'Grupo F', G: 'Grupo G', H: 'Grupo H',
  ESPECIAL: 'Especiais', LENDAS: 'Lendas', SELEÇÃO: 'Seleção'
};

// ===== STATUS PEDIDO =====
const STATUS_INFO = {
  aguardando: { label: 'Aguardando', cor: '#f59e0b', bg: '#fef3c7' },
  confirmado: { label: 'Confirmado', cor: '#3b82f6', bg: '#dbeafe' },
  enviado:    { label: 'Enviado',    cor: '#8b5cf6', bg: '#ede9fe' },
  entregue:   { label: 'Entregue',  cor: '#10b981', bg: '#d1fae5' },
  cancelado:  { label: 'Cancelado', cor: '#ef4444', bg: '#fee2e2' }
};

function badgeStatus(status) {
  const s = STATUS_INFO[status] || STATUS_INFO.aguardando;
  return `<span style="background:${s.bg};color:${s.cor};font-size:0.75rem;font-weight:700;padding:3px 10px;border-radius:20px;white-space:nowrap;">${s.label}</span>`;
}

// ===== ADICIONAR AO CARRINHO =====
function adicionarAoCarrinho(id) {
  const db  = getDB();
  const fig = db.find(f => f.id === id);
  if (!fig || fig.estoque <= 0) return;

  const carrinho = getCarrinho();
  const idx = carrinho.findIndex(i => i.id === id);

  if (idx >= 0) {
    if (carrinho[idx].qtd < fig.estoque) { carrinho[idx].qtd++; }
    else { showToast('Quantidade máxima atingida!', 'info'); return; }
  } else {
    carrinho.push({ id, qtd: 1 });
  }

  saveCarrinho(carrinho);
  atualizarBadgeCarrinho();
  showToast(`${fig.nome} adicionado ao carrinho!`);
}

// ===== CARD FIGURINHA =====
function criarCardFigurinha(fig) {
  const esgotado = fig.estoque <= 0;
  const imgHTML  = fig.imagem
    ? `<img src="${fig.imagem}" alt="${fig.nome}" loading="lazy">`
    : `<div class="sem-foto">⚽</div>`;
  return `
    <div class="card-figurinha" data-id="${fig.id}" data-grupo="${fig.grupo}">
      <div class="card-img">
        ${imgHTML}
        <span class="badge-grupo">${fig.grupo}</span>
        <span class="badge-numero">#${String(fig.numero).padStart(3,'0')}</span>
        ${esgotado ? '<div class="badge-esgotado">ESGOTADO</div>' : ''}
      </div>
      <div class="card-body">
        <div class="card-nome">${fig.nome}</div>
        ${fig.descricao ? `<div class="card-desc">${fig.descricao}</div>` : ''}
      </div>
      <div class="card-footer">
        <span class="card-preco">${formatarPreco(fig.preco)}</span>
        <button class="btn-add-cart" onclick="adicionarAoCarrinho('${fig.id}')" ${esgotado ? 'disabled' : ''}>
          ${esgotado ? 'Esgotado' : '🛒 Comprar'}
        </button>
      </div>
    </div>`;
}

// ===== LOADING STATE =====
function showLoading(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#999;">
      <div style="font-size:2rem;margin-bottom:12px;animation:spin 1s linear infinite;display:inline-block">⚽</div>
      <p>Carregando...</p>
    </div>`;
}

// ===== SALVAR PEDIDO VIA API =====
async function salvarPedido(cliente, itensCarrinho, frete) {
  const db = getDB();
  const itensDetalhados = itensCarrinho.map(item => {
    const fig = db.find(f => f.id === item.id);
    return {
      id: item.id,
      nome:          fig ? fig.nome   : 'Figurinha',
      numero:        fig ? fig.numero : 0,
      grupo:         fig ? fig.grupo  : '',
      imagem:        fig ? (fig.imagem || '') : '',
      qtd:           item.qtd,
      precoUnitario: fig ? Number(fig.preco) : 0,
      subtotal:      (fig ? Number(fig.preco) : 0) * item.qtd
    };
  });
  const subtotal = itensDetalhados.reduce((s, i) => s + i.subtotal, 0);
  const total    = subtotal + Number(frete);

  const pedido = await apiCreatePedido({ cliente, itens: itensDetalhados, subtotal, frete: Number(frete), total, status: 'aguardando' });
  await refreshDB(); // atualiza estoque no cache
  return pedido;
}

// ===== INIT GERAL =====
document.addEventListener('DOMContentLoaded', async () => {
  // Adiciona animação de loading spinner
  const style = document.createElement('style');
  style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(style);

  initMenuMobile();
  atualizarBadgeCarrinho();

  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav a').forEach(a => {
    if (a.getAttribute('href') === path) a.classList.add('ativo');
  });

  if (typeof initPagina === 'function') await initPagina();
});
