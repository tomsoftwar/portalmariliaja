MARÍLIAJÁ — VERSÃO RECONSTRUÍDA
================================

O QUE ESTA VERSÃO INCLUI
- Portal responsivo em vermelho, preto e branco.
- Notícias públicas lidas diretamente da coleção Firestore "noticias".
- Painel administrativo em admin.html.
- Login por Firebase Authentication (e-mail/senha).
- Publicar, editar e excluir notícias no Firestore.
- Regras de segurança: qualquer visitante lê notícias; somente usuários com documento admins/{UID} e ativo=true podem alterar.
- Não usa localStorage para publicar notícias; os artigos são compartilhados pelo banco de dados.

IMPORTANTE: nenhum arquivo de site consegue criar ou configurar o banco de dados dentro da sua conta Firebase sem você autorizar. A base Firebase já informada foi pré-configurada, mas falta inserir a API KEY e publicar as regras no console.

PASSO 1 — API KEY
1. Abra https://console.firebase.google.com/
2. Selecione o projeto mariliaja-94f23.
3. Clique na engrenagem ao lado de "Visão geral do projeto" > Configurações do projeto.
4. Em "Seus aplicativos", selecione o app Web.
5. Copie o valor apiKey.
6. Abra assets/js/firebase-config.js e substitua COLE_AQUI_A_API_KEY_DO_FIREBASE pelo valor copiado.
   A configuração web do Firebase não é uma senha de administrador. Nunca coloque senhas de usuário neste arquivo.

PASSO 2 — REGRAS DO BANCO
1. No Firebase, abra Firestore Database > Regras.
2. Substitua o conteúdo pelas regras do arquivo firestore.rules.
3. Clique em Publicar.
   As regras permitem leitura pública das notícias, mas escrita apenas a administradores autenticados.

PASSO 3 — VERIFIQUE O ADMINISTRADOR
1. Em Authentication > Users, confirme que o usuário administrador existe.
2. Copie o UID exato desse usuário.
3. Em Firestore > Dados, abra a coleção admins.
4. O documento precisa ter o ID igual ao UID (não o e-mail) e o campo ativo com valor booleano true.

PASSO 4 — SUBIR PARA GITHUB PAGES
1. Faça backup do repositório atual antes de substituir arquivos.
2. Envie os arquivos e pastas deste pacote para a raiz do repositório MARILIAJA, branch main.
3. Mantenha index.html na raiz e as pastas assets/ e data/.
4. Esta versão é estática: não precisa de npm install nem de GitHub Actions para compilar.
5. Abra o site publicado e teste admin.html.

PASSO 5 — TESTAR
1. Entre no painel, publique uma notícia de teste.
2. Abra o portal em janela anônima ou outro celular.
3. A notícia deverá aparecer para todos.
4. Se aparecer erro de permissão, confira as regras e o documento admins/{UID}.

OBSERVAÇÕES
- Não copie a senha de administrador para nenhum arquivo.
- A coleção esperada é "noticias", exatamente assim.
- O portal usa os campos title, summary, content, category, imageUrl, imageCaption, isFeatured, createdAt e updatedAt. O código também lê alguns campos em português para compatibilidade com documentos de teste antigos.
- Esta reconstrução inclui a estrutura principal do portal e publicação. Ela não recupera automaticamente notícias antigas salvas apenas no localStorage do navegador; essas notícias precisariam ser publicadas novamente no Firestore.
