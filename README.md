# GitStatsHub

Uma Single Page Application (SPA) moderna, leve e sem backend contínuo, projetada para exibir estatísticas detalhadas do seu perfil no GitHub. O projeto utiliza GitHub Actions e Python para coletar dados diariamente e gerar uma página estática publicada via GitHub Pages.

## 🚀 Arquitetura e Fluxo de Dados

1. **Python (Data Collector):** O script `src/fetch_stats.py` se autentica com a API do GitHub (REST para dados de perfil/repositórios e GraphQL para o calendário de contribuições e PRs/Issues) para compilar um `stats.json`.
2. **GitHub Actions (Automação & Build):** Um workflow configurado no `.github/workflows/deploy.yml` roda todos os dias à meia-noite (ou sob demanda). Ele cria a pasta `dist/`, roda o script Python exportando o `stats.json` lá dentro, e empacota tudo.
3. **Frontend (SPA):** Interface responsiva em HTML/TailwindCSS com `public/app.js` consumindo o `stats.json` e renderizando gráficos utilizando a biblioteca `Chart.js`.
4. **Deploy (GitHub Pages):** A pasta gerada no artefato das actions é publicada diretamente para os servidores da web estática do GitHub.

## 🛠️ Como utilizar no seu próprio Perfil

1. Faça um **Fork** deste repositório para a sua conta.
2. Acesse a aba **Actions** no seu fork e clique em *"I understand my workflows, go ahead and enable them"* para permitir que o script execute no seu repositório.
3. Certifique-se de que o **GitHub Pages** está ativado:
   - Vá na aba **Settings** > **Pages**
   - Na opção *Build and deployment*, escolha **GitHub Actions** em *Source*.
4. Teste a execução manual:
   - Volte na aba **Actions**
   - Selecione o workflow **Generate and Deploy GitHub Stats**
   - Clique no botão **Run workflow**.

> [!NOTE]
> O workflow fará uso automático do seu `GITHUB_TOKEN` injetado pelo GitHub Actions. Não há necessidade de configurar tokens manuais (PATs) no repositório apenas para buscar as estatísticas deste sistema, desde que o workflow rode em sua própria conta.

## 💻 Setup e Teste Local

### Pré-requisitos
- Python 3.14+
- Terminal e Node/Python HTTP Server
- Um [Personal Access Token (PAT)](https://github.com/settings/tokens) gerado no GitHub (somente se quiser testar a coleta localmente).

### Instruções

1. Clone o seu fork:
```bash
git clone https://github.com/SEU_USUARIO/GitStatsHub.git
cd GitStatsHub
```

2. Crie e ative um ambiente virtual e instale dependências:
```bash
python -m venv venv
source venv/bin/activate  # ou venv\Scripts\activate no Windows
pip install -r requirements.txt
```

3. Exporte as variáveis de ambiente necessárias e rode a coleta de dados:
```bash
export GITHUB_TOKEN="seu_personal_access_token"
export GITHUB_USERNAME="seu_usuario"

mkdir -p dist
cp -r public/* dist/
python src/fetch_stats.py
```
Isso vai gerar o arquivo `stats.json` devidamente preenchido dentro do diretório `dist/`.

4. Sirva o diretório gerado:
```bash
cd dist
python -m http.server 8000
```
Acesse `http://localhost:8000` no seu navegador para verificar a interface renderizando localmente.
