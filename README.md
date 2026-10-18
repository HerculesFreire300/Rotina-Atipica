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
| Planos e pagamento | Checkout recorrente, cancelamento autenticado e sincronização de status via webhook do Mercado Pago em Supabase Edge Functions. O botão fica desativado até a implantação e configuração dos segredos. |
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

## Ativação do Mercado Pago

O checkout permanece desativado em `supabase-config.js` (`paymentsEnabled: false`) até que todos os passos abaixo sejam concluídos e testados. Não coloque tokens ou segredos em arquivos do app, no GitHub ou em mensagens.

1. Crie/configure uma aplicação no Mercado Pago e obtenha as credenciais de teste. Configure também um usuário comprador de teste.
2. Aplique a migração `supabase/migrations/20260601000000_assinatura_unica_por_usuario.sql` no SQL Editor do projeto. Ela impede que uma conta abra duas assinaturas pendentes/ativas ao mesmo tempo e garante que uma assinatura só libere acesso quando houver uma data de período pago vigente.
3. Instale a Supabase CLI. Na raiz do projeto, execute `supabase login`, `supabase link --project-ref judiqzanpheqnjntrsij`, `supabase db push` e `supabase functions deploy criar-assinatura`, `supabase functions deploy cancelar-assinatura` e `supabase functions deploy mp-webhook`. As duas funções de conta exigem JWT; o webhook é público e valida a assinatura HMAC do Mercado Pago.
4. No painel do Supabase, em **Edge Functions → Secrets**, configure `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_ANON_KEY`. Use o token e o segredo de webhook da mesma aplicação/ambiente; nunca use a chave `service_role` no navegador. O URL do Supabase é fornecido ao runtime como `SUPABASE_URL`.
5. No painel de notificações da aplicação Mercado Pago, configure a URL `https://judiqzanpheqnjntrsij.supabase.co/functions/v1/mp-webhook` e habilite notificações de assinatura (`subscription_preapproval`), pagamentos (`payment`) e pagamentos autorizados de assinatura (`subscription_authorized_payment`).
6. Teste cadastro/checkout de ambos os planos, aprovação e recusa, entrega/repetição de notificações, liberação de acesso, cancelamento e manutenção de acesso até o fim do período pago. Confirme a mudança de status na tabela `assinaturas` e o histórico na tabela `pagamentos`.
7. Só depois dos testes, altere `paymentsEnabled` para `true` em `supabase-config.js` e publique a versão web. As credenciais de produção e a URL de notificações de produção devem pertencer ao ambiente/aplicação de produção do Mercado Pago.

O token de acesso do Mercado Pago e o segredo HMAC são necessários para ativar a cobrança. O webhook busca o estado atual diretamente no Mercado Pago antes de atualizar o banco; o navegador não pode definir se uma assinatura está paga.

## Pendências antes de lançar

- **Licença ARASAAC**: os pictogramas são CC BY-NC-SA, que não permite uso comercial. Para usar numa plataforma paga é preciso autorização do Governo de Aragão, ou usar outros pictogramas (ex.: emojis abertos como OpenMoji, desenhos próprios).
- Configurar e testar os redirecionamentos de autenticação no projeto Supabase.
- Implantar e testar as funções de pagamento do Mercado Pago e configurar os segredos diretamente no painel Supabase; os botões permanecem desativados até lá.
- Implementar exclusão autenticada da conta e dos objetos do Storage; até lá, o app encaminha solicitações ao suporte.
- Decidir como importar, com consentimento explícito, os dados legados que ainda estejam no navegador.
- Revisão jurídica dos textos de privacidade e termos.
