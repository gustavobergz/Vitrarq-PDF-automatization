# Deploy na Vercel

1. Suba esta pasta para um repositório no GitHub.
2. Importe o repositório na Vercel.
3. Em `Settings > Environment Variables`, crie:
   - `SITE_PASSWORD`: a senha para entrar no orçamento.
   - `AUTH_SECRET`: uma frase longa aleatória, usada para assinar o cookie.
4. Faça o deploy.

O conteúdo do orçamento fica protegido pela função serverless em `api/app.js`. A senha não fica no JavaScript público e os arquivos do site só são servidos depois do login.
