// ===== DADOS COMPARTILHADOS =====
const DB_KEY      = 'figurinhas_copa2k26';
const CART_KEY    = 'carrinho_copa2k26';
const ORDERS_KEY  = 'pedidos_copa2k26';

function getDB()          { return JSON.parse(localStorage.getItem(DB_KEY)     || '[]'); }
function saveDB(d)        { localStorage.setItem(DB_KEY,     JSON.stringify(d)); }
function getCarrinho()    { return JSON.parse(localStorage.getItem(CART_KEY)   || '[]'); }
function saveCarrinho(d)  { localStorage.setItem(CART_KEY,   JSON.stringify(d)); }
function getOrders()      { return JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]'); }
function saveOrders(d)    { localStorage.setItem(ORDERS_KEY, JSON.stringify(d)); }

// ===== SALVAR PEDIDO (chamado no checkout) =====
function salvarPedido(cliente, itensCarrinho, frete) {
  const db = getDB();

  const itensDetalhados = itensCarrinho.map(item => {
    const fig = db.find(f => f.id === item.id);
    return {
      id:             item.id,
      nome:           fig ? fig.nome   : 'Figurinha',
      numero:         fig ? fig.numero : 0,
      grupo:          fig ? fig.grupo  : '',
      imagem:         fig ? (fig.imagem || '') : '',
      qtd:            item.qtd,
      precoUnitario:  fig ? Number(fig.preco) : 0,
      subtotal:       (fig ? Number(fig.preco) : 0) * item.qtd
    };
  });

  const subtotal = itensDetalhados.reduce((s, i) => s + i.subtotal, 0);
  const total    = subtotal + Number(frete);

  // Baixar estoque automaticamente
  const dbAtualizado = db.map(fig => {
    const item = itensCarrinho.find(i => i.id === fig.id);
    return item ? { ...fig, estoque: Math.max(0, fig.estoque - item.qtd) } : fig;
  });
  saveDB(dbAtualizado);

  const pedido = {
    id:       'PED' + Date.now(),
    data:     new Date().toISOString(),
    cliente,
    itens:    itensDetalhados,
    subtotal,
    frete:    Number(frete),
    total,
    status:   'aguardando'
  };

  const orders = getOrders();
  orders.unshift(pedido);
  saveOrders(orders);
  return pedido;
}

// ===== STATUS PEDIDO =====
const STATUS_INFO = {
  aguardando:  { label: 'Aguardando',  cor: '#f59e0b', bg: '#fef3c7' },
  confirmado:  { label: 'Confirmado',  cor: '#3b82f6', bg: '#dbeafe' },
  enviado:     { label: 'Enviado',     cor: '#8b5cf6', bg: '#ede9fe' },
  entregue:    { label: 'Entregue',    cor: '#10b981', bg: '#d1fae5' },
  cancelado:   { label: 'Cancelado',   cor: '#ef4444', bg: '#fee2e2' }
};

function badgeStatus(status) {
  const s = STATUS_INFO[status] || STATUS_INFO.aguardando;
  return `<span style="background:${s.bg};color:${s.cor};font-size:0.75rem;font-weight:700;
    padding:3px 10px;border-radius:20px;white-space:nowrap;">${s.label}</span>`;
}

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

// ===== INIT GERAL =====
document.addEventListener('DOMContentLoaded', () => {
  initMenuMobile();
  atualizarBadgeCarrinho();
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav a').forEach(a => {
    if (a.getAttribute('href') === path) a.classList.add('ativo');
  });
  if (typeof initPagina === 'function') initPagina();
});

// ===== SEED FIGURINHAS =====
function seedDadosExemplo() {
  if (getDB().length > 0) return;
  saveDB([
    { id:'1',  numero:1,  nome:'Lionel Messi',       grupo:'A',      descricao:'Argentina - Campeão do Mundo',    preco:4.90, estoque:10, imagem:'' },
    { id:'2',  numero:2,  nome:'Cristiano Ronaldo',   grupo:'A',      descricao:'Portugal - Lenda do Futebol',     preco:4.90, estoque:8,  imagem:'' },
    { id:'3',  numero:3,  nome:'Vinicius Jr.',         grupo:'B',      descricao:'Brasil - Estrela da Copa',        preco:3.90, estoque:15, imagem:'' },
    { id:'4',  numero:4,  nome:'Rodri',               grupo:'B',      descricao:'Espanha - Melhor do Mundo',       preco:3.50, estoque:12, imagem:'' },
    { id:'5',  numero:5,  nome:'Erling Haaland',      grupo:'C',      descricao:'Noruega - Goleador',              preco:4.50, estoque:9,  imagem:'' },
    { id:'6',  numero:6,  nome:'Kylian Mbappé',       grupo:'C',      descricao:'França - Velocidade Extrema',     preco:4.90, estoque:0,  imagem:'' },
    { id:'7',  numero:7,  nome:'Jude Bellingham',     grupo:'D',      descricao:'Inglaterra - Promessa',           preco:3.90, estoque:11, imagem:'' },
    { id:'8',  numero:8,  nome:'Richarlison',         grupo:'D',      descricao:'Brasil - Atacante',               preco:2.90, estoque:20, imagem:'' },
    { id:'9',  numero:9,  nome:'Pelé',                grupo:'LENDAS', descricao:'O Rei do Futebol',                preco:9.90, estoque:3,  imagem:'' },
    { id:'10', numero:10, nome:'Ronaldinho Gaúcho',   grupo:'LENDAS', descricao:'O Bruxo',                         preco:8.90, estoque:5,  imagem:'' },
  ]);
}

// ===== SEED PEDIDOS DE EXEMPLO =====
function seedPedidosExemplo() {
  if (getOrders().length > 0) return;

  const clientes = [
    { nome:'Ana Paula Silva',   telefone:'11987654321', endereco:'Rua das Rosas, 45 - São Paulo/SP',    obs:'' },
    { nome:'Carlos Mendes',     telefone:'21976543210', endereco:'Av. Copacabana, 200 - Rio de Janeiro/RJ', obs:'Entregar após 18h' },
    { nome:'Fernanda Costa',    telefone:'31965432109', endereco:'Rua Ouro Preto, 77 - Belo Horizonte/MG', obs:'' },
    { nome:'João Pedro Santos', telefone:'11954321098', endereco:'Rua Augusta, 300 - São Paulo/SP',     obs:'Chamar no portão' },
    { nome:'Mariana Oliveira',  telefone:'41943210987', endereco:'Rua das Flores, 12 - Curitiba/PR',    obs:'' },
    { nome:'Rafael Souza',      telefone:'85932109876', endereco:'Av. Beira Mar, 55 - Fortaleza/CE',    obs:'' },
  ];

  const db     = getDB();
  const agora  = Date.now();
  const dia    = 86400000;
  const pedidos = [];

  const combos = [
    [['1',1],['3',2]],
    [['2',1],['9',1]],
    [['3',3],['8',2],['7',1]],
    [['5',1],['4',2]],
    [['9',1],['10',1]],
    [['1',2],['6',1],['3',1]],
    [['7',2],['8',3]],
    [['2',1],['4',1],['5',2]],
    [['10',1],['9',2]],
    [['3',1],['1',1],['7',1]],
  ];

  const statusList = ['entregue','entregue','entregue','confirmado','aguardando','enviado','entregue','confirmado','cancelado','entregue'];

  combos.forEach((combo, i) => {
    const cliente = clientes[i % clientes.length];
    const itens   = combo.map(([id, qtd]) => {
      const fig = db.find(f => f.id === id);
      return fig ? {
        id, nome: fig.nome, numero: fig.numero, grupo: fig.grupo, imagem: fig.imagem || '',
        qtd, precoUnitario: Number(fig.preco), subtotal: Number(fig.preco) * qtd
      } : null;
    }).filter(Boolean);

    const subtotal = itens.reduce((s, x) => s + x.subtotal, 0);
    const frete    = 8.00;
    const total    = subtotal + frete;
    const offset   = (i === 0 ? 0 : i === 1 ? dia*0.5 : i < 4 ? dia*1 : i < 6 ? dia*2 : i < 8 ? dia*4 : dia*6);

    pedidos.push({
      id:       'PED' + (agora - offset - i * 3600000),
      data:     new Date(agora - offset - i * 3600000).toISOString(),
      cliente,
      itens,
      subtotal,
      frete,
      total,
      status:   statusList[i]
    });
  });

  saveOrders(pedidos);
}
