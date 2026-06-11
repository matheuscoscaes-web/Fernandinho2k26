// ===== CLIENTE DE API (frontend) =====
// Cache em memória — carregado uma vez por página
let _db     = [];
let _orders = [];

// ===== FIGURINHAS =====
async function apiGetFigurinhas() {
  const r = await fetch('/api/figurinhas');
  return r.json();
}

async function apiCreateFigurinha(data) {
  const r = await fetch('/api/figurinhas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return r.json();
}

async function apiUpdateFigurinha(id, data) {
  const r = await fetch('/api/figurinhas/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return r.json();
}

async function apiDeleteFigurinha(id) {
  const r = await fetch('/api/figurinhas/' + id, { method: 'DELETE' });
  return r.json();
}

async function apiReporEstoque(id, delta) {
  const r = await fetch('/api/figurinhas/' + id + '/estoque', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delta })
  });
  return r.json();
}

// ===== PEDIDOS =====
async function apiGetPedidos() {
  const r = await fetch('/api/pedidos');
  return r.json();
}

async function apiCreatePedido(data) {
  const r = await fetch('/api/pedidos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return r.json();
}

async function apiUpdateStatus(id, status) {
  const r = await fetch('/api/pedidos/' + id + '/status', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  return r.json();
}

// ===== CACHE — usado por script.js =====
async function refreshDB() {
  _db = await apiGetFigurinhas();
  return _db;
}

async function refreshOrders() {
  _orders = await apiGetPedidos();
  return _orders;
}

async function refreshAll() {
  await Promise.all([refreshDB(), refreshOrders()]);
}

// Leituras síncronas do cache
function getDB()     { return _db; }
function getOrders() { return _orders; }

// Cart permanece em localStorage (é por sessão/usuário)
const CART_KEY = 'carrinho_copa2k26';
function getCarrinho()   { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
function saveCarrinho(d) { localStorage.setItem(CART_KEY, JSON.stringify(d)); }
