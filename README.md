# Rotina Atípica

Plataforma web (acessada pelo navegador, com conta de usuária) de rotina visual para mães de crianças autistas e atípicas. Funciona no celular, tablet e computador e pode ser instalada na tela inicial (PWA).

## O que já existe

- `index.html`, `app.js` e `style.css`: plataforma web responsiva.
- Cadastro, confirmação de e-mail, login e sessão usam Supabase Auth.
- Rotina, espera, sentimentos e escala são salvos nas configurações dos quadros no Supabase. Fotos e áudios ficam no bucket privado `midia`.
- `supabase-config.js`: URL do projeto e chave publicável do Supabase. Essa chave pode aparecer no navegador; nunca coloque aqui uma chave secreta ou `service_role`.
- `schema.sql`: tabelas, regras RLS, bucket privado e funções administrativas. O esquema já foi aplicado ao projeto Supabase.

## Telas da v1

| Tela | O que faz |
|---|---|
| Cadastro | Nome, e-mail, senha, nome da criança e aceite dos termos. Começa o teste de 7 dias. |
| Início | O próximo passo da rotina, atalhos para os 4 quadros, dias de teste restantes e WhatsApp. |
| Rotina | "Agora" e "Depois" em cartões grandes, checklist do dia, editar passos (emoji/pictograma, foto própria, voz da mãe). |
| Espera | Timer visual em círculo (1 a 15 min), som suave no fim e "enquanto espero, eu posso". |
| Sentimentos | 12 sentimentos; tocar mostra em tela cheia e fala a frase (voz do aparelho ou gravada). |
| Escala | 5 níveis de cor e "o que me ajuda" em cada nível, editável pela mãe. |
| Modo criança | Em qualquer quadro: esconde edição e menus; para sair é preciso segurar o cadeado. |
| Planos e pagamento | Planos são informativos; a integração de cobrança ainda não está ativa. O banco bloqueia gravações após o teste até haver assinatura ativa. |
| Minha conta | Editar nome e dados da criança, ver o status da assinatura e sair. Solicitação de exclusão é encaminhada ao suporte. |
| Ajuda | WhatsApp (65) 99308-5010 com mensagem pronta. |
| Privacidade e termos | Rascunho com LGPD e dados de crianças (art. 14). Precisa de revisão jurídica. |
| Painel admin | Acesso limitado ao papel de administradora; indicadores ainda não estão ligados à interface. |

## Configuração do Supabase

1. O cadastro cria a conta no Supabase Auth; o trigger do esquema cria o perfil e inicia o teste de 7 dias.
2. Em **Authentication → URL Configuration**, configure `https://herculesfreire300.github.io/Rotina-Atipica/` como URL do site e inclua a mesma URL na lista de redirecionamentos permitidos.
3. Em **Authentication → Providers → Email**, escolha se o e-mail precisa ser confirmado. Com confirmação ativa, a usuária deve confirmar a mensagem antes do primeiro login.
4. As regras RLS controlam o acesso aos dados. A chave publicável do cliente não substitui RLS; nunca use uma chave secreta ou `service_role` no frontend.

O app exige conexão com o Supabase e não mantém uma cópia local da rotina. Estados antigos salvos pelo protótipo no `localStorage` não são importados automaticamente.

## Pendências antes de lançar

- **Licença ARASAAC**: os pictogramas são CC BY-NC-SA, que não permite uso comercial. Para usar numa plataforma paga é preciso autorização do Governo de Aragão, ou usar outros pictogramas (ex.: emojis abertos como OpenMoji, desenhos próprios).
- Configurar e testar os redirecionamentos de autenticação no projeto Supabase.
- Implementar checkout e webhook do Mercado Pago; os botões de pagamento permanecem desativados até lá.
- Implementar exclusão autenticada da conta e dos objetos do Storage; até lá, o app encaminha solicitações ao suporte.
- Decidir como importar, com consentimento explícito, os dados legados que ainda estejam no navegador.
- Revisão jurídica dos textos de privacidade e termos.
