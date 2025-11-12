const express = require('express');
const { Pool } = require('pg'); // Importa o "tradutor" do PostgreSQL
const app = express();
const port = process.env.PORT || 3001;

// --- CONFIGURAÇÃO DA CONEXÃO COM O BANCO DE DADOS ---
// O Render nos dá a URL de conexão na variável de ambiente DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Necessário para conexões no Render
  }
});

// --- ROTA PARA CRIAR AS TABELAS (APENAS PARA SETUP INICIAL) ---
app.get('/setup/create-tables', async (req, res) => {
  const client = await pool.connect();
  try {
    // O código SQL que planejamos para criar as tabelas
    const createTablesQuery = `
      CREATE TYPE perfil_usuario AS ENUM ('ADMIN', 'PRODUCAO', 'PRE_PESAGEM', 'CONSULTA');
      CREATE TABLE Usuarios ( id SERIAL PRIMARY KEY, nome VARCHAR(100) NOT NULL, email VARCHAR(100) UNIQUE NOT NULL, senha_hash VARCHAR(255) NOT NULL, perfil perfil_usuario NOT NULL, data_criacao TIMESTAMPTZ DEFAULT NOW() );
      CREATE TABLE MateriasPrimas ( id SERIAL PRIMARY KEY, nome VARCHAR(100) UNIQUE NOT NULL, unidade_medida VARCHAR(10) NOT NULL, data_criacao TIMESTAMPTZ DEFAULT NOW() );
      CREATE TABLE Receitas ( id SERIAL PRIMARY KEY, nome VARCHAR(100) UNIQUE NOT NULL, rendimento DECIMAL(10, 3) NOT NULL, unidade_rendimento VARCHAR(10) NOT NULL, eh_sub_receita BOOLEAN NOT NULL DEFAULT FALSE );
      CREATE TABLE IngredientesReceita ( id SERIAL PRIMARY KEY, receita_id INTEGER NOT NULL REFERENCES Receitas(id) ON DELETE CASCADE, materia_prima_id INTEGER REFERENCES MateriasPrimas(id) ON DELETE SET NULL, sub_receita_id INTEGER REFERENCES Receitas(id) ON DELETE SET NULL, quantidade DECIMAL(10, 3) NOT NULL, CONSTRAINT chk_ingrediente_ou_subreceita CHECK ((materia_prima_id IS NOT NULL AND sub_receita_id IS NULL) OR (materia_prima_id IS NULL AND sub_receita_id IS NOT NULL)) );
      CREATE TYPE status_pedido AS ENUM ('PENDENTE', 'EM_SEPARACAO', 'CONCLUIDO');
      CREATE TABLE PedidosProducao ( id SERIAL PRIMARY KEY, data_producao DATE NOT NULL, status status_pedido NOT NULL DEFAULT 'PENDENTE', solicitante_id INTEGER REFERENCES Usuarios(id) ON DELETE SET NULL, data_criacao TIMESTAMPTZ DEFAULT NOW() );
      CREATE TABLE ItensPedido ( id SERIAL PRIMARY KEY, pedido_id INTEGER NOT NULL REFERENCES PedidosProducao(id) ON DELETE CASCADE, receita_id INTEGER NOT NULL REFERENCES Receitas(id) ON DELETE RESTRICT, quantidade DECIMAL(10, 3) NOT NULL );
      CREATE TYPE status_kit AS ENUM ('PENDENTE', 'CONCLUIDO');
      CREATE TABLE KitsSeparacao ( id SERIAL PRIMARY KEY, item_pedido_id INTEGER NOT NULL REFERENCES ItensPedido(id) ON DELETE CASCADE, receita_id INTEGER NOT NULL REFERENCES Receitas(id), status status_kit NOT NULL DEFAULT 'PENDENTE', responsavel_id INTEGER REFERENCES Usuarios(id) ON DELETE SET NULL, data_conclusao TIMESTAMPTZ );
    `;
    
    await client.query(createTablesQuery);
    res.status(200).send('Tabelas criadas com sucesso!');
  } catch (err) {
    console.error(err);
    res.status(500).send(`Erro ao criar tabelas: ${err.message}`);
  } finally {
    client.release();
  }
});

// --- ROTA PRINCIPAL ---
app.get('/', (req, res) => {
  res.send('Backend da padaria conectado! Use a rota /setup/create-tables para iniciar o banco de dados.');
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
