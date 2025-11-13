const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors'); // 1. Importe o pacote cors

const app = express();

// 2. Use o middleware do cors
app.use(cors()); // Isso permite requisições de QUALQUER origem

app.use(express.json()); // Middleware para entender JSON nas requisições
const port = process.env.PORT || 3001;

// --- CONFIGURAÇÃO DA CONEXÃO COM O BANCO DE DADOS ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- ROTA DE CADASTRO (REGISTER) ---
app.post('/api/auth/register', async (req, res) => {
  const { nome, email, senha, perfil } = req.body;

  if (!nome || !email || !senha || !perfil) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }

  try {
    // Criptografa a senha
    const salt = await bcrypt.genSalt(10);
    const senha_hash = await bcrypt.hash(senha, salt);

    const newUser = await pool.query(
      'INSERT INTO Usuarios (nome, email, senha_hash, perfil) VALUES ($1, $2, $3, $4) RETURNING id, nome, email, perfil',
      [nome, email, senha_hash, perfil]
    );

    res.status(201).json(newUser.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao registrar usuário. O e-mail já pode existir.' });
  }
});

// --- ROTA DE LOGIN ---
app.post('/api/auth/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM Usuarios WHERE email = $1', [email]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const isPasswordValid = await bcrypt.compare(senha, user.senha_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    // Gera o Token JWT
    const token = jwt.sign(
      { userId: user.id, perfil: user.perfil },
      process.env.JWT_SECRET, // Usando a variável de ambiente que já configuramos!
      { expiresIn: '8h' }
    );

    res.status(200).json({
      message: 'Login bem-sucedido!',
      token: token,
      user: { id: user.id, nome: user.nome, perfil: user.perfil }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro no servidor.' });
  }
});

// --- ROTA PRINCIPAL ---
app.get('/', (req, res) => {
  res.send('Backend da padaria com autenticação está no ar!');
});

// --- ROTAS PARA MATÉRIAS-PRIMAS (PROTEGIDAS) ---

// Middleware para verificar o token
function verificarToken(req, res, next) {
  const bearerHeader = req.headers['authorization'];
  if (typeof bearerHeader !== 'undefined') {
    const bearerToken = bearerHeader.split(' ')[1];
    req.token = bearerToken;
    jwt.verify(req.token, process.env.JWT_SECRET, (err, authData) => {
      if (err) {
        return res.sendStatus(403); // Token inválido ou expirado
      }
      req.authData = authData;
      next();
    });
  } else {
    res.sendStatus(401); // Não enviou o token
  }
}

// Rota para LER todas as matérias-primas
app.get('/api/materias-primas', verificarToken, async (req, res) => {
  try {
    const todasMateriasPrimas = await pool.query('SELECT * FROM MateriasPrimas ORDER BY nome ASC');
    res.json(todasMateriasPrimas.rows);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar matérias-primas.' });
  }
});

// Rota para CRIAR uma nova matéria-prima
app.post('/api/materias-primas', verificarToken, async (req, res) => {
  // Apenas Admins podem criar
  if (req.authData.perfil !== 'ADMIN') {
    return res.status(403).json({ message: 'Acesso negado. Somente administradores.' });
  }
  
  const { nome, unidade_medida } = req.body;
  try {
    const novaMateriaPrima = await pool.query(
      'INSERT INTO MateriasPrimas (nome, unidade_medida) VALUES ($1, $2) RETURNING *',
      [nome, unidade_medida]
    );
    res.status(201).json(novaMateriaPrima.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao criar matéria-prima.' });
  }
});


app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});


