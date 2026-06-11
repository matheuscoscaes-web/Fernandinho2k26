require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// ===== BANCO DE DADOS =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS figurinhas (
      id          TEXT PRIMARY KEY,
      numero      INTEGER NOT NULL,
      grupo       TEXT NOT NULL,
      nome        TEXT NOT NULL,
      descricao   TEXT    DEFAULT '',
      preco       DECIMAL(10,2) NOT NULL,
      estoque     INTEGER DEFAULT 0,
      imagem      TEXT    DEFAULT '',
      created_at  TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS pedidos (
      id                 TEXT PRIMARY KEY,
      data               TIMESTAMP NOT NULL,
      cliente_nome       TEXT NOT NULL,
      cliente_telefone   TEXT NOT NULL,
      cliente_endereco   TEXT NOT NULL,
      cliente_obs        TEXT DEFAULT '',
      subtotal           DECIMAL(10,2) NOT NULL,
      frete              DECIMAL(10,2) NOT NULL,
      total              DECIMAL(10,2) NOT NULL,
      status             TEXT DEFAULT 'aguardando',
      created_at         TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS pedido_itens (
      id              SERIAL PRIMARY KEY,
      pedido_id       TEXT REFERENCES pedidos(id) ON DELETE CASCADE,
      figurinha_id    TEXT,
      nome            TEXT NOT NULL,
      numero          INTEGER,
      grupo           TEXT,
      imagem          TEXT DEFAULT '',
      qtd             INTEGER NOT NULL,
      preco_unitario  DECIMAL(10,2) NOT NULL,
      subtotal        DECIMAL(10,2) NOT NULL
    );
  `);
  console.log('✅ Banco de dados inicializado.');
}

// ===== HELPERS =====
function mapFig(r) {
  return {
    id: r.id, numero: Number(r.numero), grupo: r.grupo,
    nome: r.nome, descricao: r.descricao || '',
    preco: Number(r.preco), estoque: Number(r.estoque), imagem: r.imagem || ''
  };
}

function mapPedido(p, itens) {
  return {
    id: p.id,
    data: p.data instanceof Date ? p.data.toISOString() : p.data,
    cliente: { nome: p.cliente_nome, telefone: p.cliente_telefone, endereco: p.cliente_endereco, obs: p.cliente_obs || '' },
    itens: itens.map(i => ({
      id: i.figurinha_id, nome: i.nome, numero: Number(i.numero),
      grupo: i.grupo, imagem: i.imagem || '',
      qtd: Number(i.qtd), precoUnitario: Number(i.preco_unitario), subtotal: Number(i.subtotal)
    })),
    subtotal: Number(p.subtotal), frete: Number(p.frete), total: Number(p.total), status: p.status
  };
}

// ===== ROTAS — FIGURINHAS =====
app.get('/api/figurinhas', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM figurinhas ORDER BY numero ASC');
    res.json(rows.map(mapFig));
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

app.post('/api/figurinhas', async (req, res) => {
  const { id, numero, grupo, nome, descricao, preco, estoque, imagem } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO figurinhas (id,numero,grupo,nome,descricao,preco,estoque,imagem) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [id || Date.now().toString(), numero, grupo, nome, descricao||'', preco, estoque, imagem||'']
    );
    res.json(mapFig(rows[0]));
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

app.put('/api/figurinhas/:id', async (req, res) => {
  const { numero, grupo, nome, descricao, preco, estoque, imagem } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE figurinhas SET numero=$1,grupo=$2,nome=$3,descricao=$4,preco=$5,estoque=$6,imagem=$7 WHERE id=$8 RETURNING *',
      [numero, grupo, nome, descricao||'', preco, estoque, imagem||'', req.params.id]
    );
    if (!rows.length) return res.status(404).json({ erro: 'Não encontrada' });
    res.json(mapFig(rows[0]));
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

app.delete('/api/figurinhas/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM figurinhas WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

app.patch('/api/figurinhas/:id/estoque', async (req, res) => {
  const { delta } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE figurinhas SET estoque=GREATEST(0,estoque+$1) WHERE id=$2 RETURNING *',
      [delta, req.params.id]
    );
    res.json(mapFig(rows[0]));
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ===== ROTAS — PEDIDOS =====
app.get('/api/pedidos', async (req, res) => {
  try {
    const { rows: peds  } = await pool.query('SELECT * FROM pedidos ORDER BY data DESC');
    const { rows: itens } = await pool.query('SELECT * FROM pedido_itens');
    res.json(peds.map(p => mapPedido(p, itens.filter(i => i.pedido_id === p.id))));
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

app.post('/api/pedidos', async (req, res) => {
  const { cliente, itens, subtotal, frete, total, status } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pedidoId = 'PED' + Date.now();

    await client.query(
      'INSERT INTO pedidos (id,data,cliente_nome,cliente_telefone,cliente_endereco,cliente_obs,subtotal,frete,total,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [pedidoId, new Date().toISOString(), cliente.nome, cliente.telefone, cliente.endereco, cliente.obs||'', subtotal, frete, total, status||'aguardando']
    );

    for (const item of itens) {
      await client.query(
        'INSERT INTO pedido_itens (pedido_id,figurinha_id,nome,numero,grupo,imagem,qtd,preco_unitario,subtotal) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [pedidoId, item.id, item.nome, item.numero, item.grupo, item.imagem||'', item.qtd, item.precoUnitario, item.subtotal]
      );
      await client.query(
        'UPDATE figurinhas SET estoque=GREATEST(0,estoque-$1) WHERE id=$2',
        [item.qtd, item.id]
      );
    }

    await client.query('COMMIT');
    const { rows: [ped] }    = await pool.query('SELECT * FROM pedidos WHERE id=$1', [pedidoId]);
    const { rows: pedItens } = await pool.query('SELECT * FROM pedido_itens WHERE pedido_id=$1', [pedidoId]);
    res.json(mapPedido(ped, pedItens));
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ erro: e.message });
  } finally { client.release(); }
});

app.patch('/api/pedidos/:id/status', async (req, res) => {
  try {
    await pool.query('UPDATE pedidos SET status=$1 WHERE id=$2', [req.body.status, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ===== FALLBACK SPA =====
app.get('*', (req, res) => {
  if (!req.path.includes('.')) res.sendFile(path.join(__dirname, 'index.html'));
  else res.status(404).end();
});

// ===== START =====
initDB()
  .then(() => app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`)))
  .catch(e => { console.error('Erro ao iniciar banco:', e.message); process.exit(1); });
