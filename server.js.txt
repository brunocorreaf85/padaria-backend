const express = require('express');
const app = express();
const port = process.env.PORT || 3001;

app.get('/', (req, res) => {
  res.send('Olá, mundo! O backend da padaria está no ar!');
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
