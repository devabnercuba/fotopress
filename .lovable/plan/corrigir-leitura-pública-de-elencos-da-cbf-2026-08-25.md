# Corrigir leitura pública de elencos da CBF

## Escopo

- Alterar somente o provider de atletas da CBF em `src/services/athletes/providers.ts`.
- Manter intactos o importador CBF de jogos, os demais providers, deduplicação, fontes, limpeza e cadastro manual.

## Implementação

- Criar uma aquisição HTTP específica para URLs públicas de times da CBF, com headers de navegador solicitados, sem cookies/credenciais e com no máximo duas tentativas.
- Seguir apenas redirects HTTPS cujo host final seja `cbf.com.br` ou `www.cbf.com.br`, validando a URL final antes de aceitar o conteúdo.
- Aceitar apenas HTML que contenha a estrutura real de página de time e tabela de atletas; detectar challenge/CAPTCHA e retornar diagnóstico seguro.
- Preservar o parser CBF existente, acrescentando somente a leitura do ID externo quando ele estiver publicado no HTML da própria linha.
- Em falha 403 persistente, registrar internamente provider, status, URL e tentativa, retornando a mensagem amigável solicitada sem alterar a fonte.

## Validação

- Adicionar testes focados no request CBF: headers, retry único, redirects permitidos/bloqueados, HTML inválido/challenge e extração do elenco.
- Testar as URLs reais informadas (Brusque e Série B) e registrar quantidade de atletas, clube atual divergente e disponibilidade de IDs externos.
- Confirmar build e fluxo de análise/preview sem modificar sua arquitetura.
