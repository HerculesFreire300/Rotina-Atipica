# Rotina Atípica

Plataforma web (acessada pelo navegador, com conta de usuária) de rotina visual para mães de crianças autistas e atípicas. Funciona no celular, tablet e computador e pode ser instalada na tela inicial (PWA).

## O que já existe

- `index.html`, `app.js` e `style.css`: plataforma web responsiva.
- Instalação como app no celular pelo manifesto PWA, ícones da tela inicial e cache da interface; no iPhone/iPad, o botão mostra as instruções do Safari.
- Cadastro, confirmação de e-mail, login e sessão usam Supabase Auth.
- Login com opção para manter a sessão neste dispositivo; somente o token de sessão é armazenado, nunca a senha. Ao desmarcar, a sessão dura até fechar o navegador.
- Recuperação de senha por link de e-mail e formulário para cadastrar uma nova senha.
- Rotina, espera, sentimentos e escala são salvos nas configurações dos quadros no Supabase. Fotos e áudios ficam no bucket privado `midia`.
- Calendário privado de consultas e terapias, com agendamento de psicólogo(a), terapeuta ocupacional, fonoaudiólogo(a) e neuropediatra.
- Rotinas separadas por manhã, tarde e noite, com modelos que podem ser acrescentados sem duplicar passos existentes.
- Lembretes push diários opcionais e avisos de consultas 24 horas e 2 horas antes. O envio requer configurar as chaves VAPID, a função Edge e o agendamento no Supabase.
- `supabase-config.js`: URL do projeto e chave publicável do Supabase. Essa chave pode aparecer no navegador; nunca coloque aqui uma chave secreta ou `service_role`.
- `schema.sql`: esquema base, regras RLS, bucket privado e funções administrativas; as migrações novas precisam ser aplicadas com `supabase db push`.

## Telas da v1

| Tela | O que faz |
|---|---|
| Cadastro | Nome, e-mail, senha, nome da criança e aceite dos termos. Começa o teste de 7 dias. |
| Início | O próximo passo da rotina, atalhos para os 4 quadros, dias de teste restantes, acesso a "Suas fotos" e WhatsApp. |
| Rotina | "Agora" e "Depois" em cartões grandes, checklist do dia e edição de passos (emoji, fotos próprias e voz da mãe), organizados por manhã, tarde e noite. Inclui modelos para começo do dia, escola, volta para casa e hora de dormir. |
| Consultas e terapias | Calendário mensal privado com agendamentos de psicólogo(a), terapeuta ocupacional, fonoaudiólogo(a) e neuropediatra. Opção de receber notificações push 24 horas e 2 horas antes. |
| Suas fotos | Tela para adicionar, trocar ou remover fotos em cada cartão da rotina. |
| Espera | Timer visual em círculo (1 a 15 min), som suave no fim e "enquanto espero, eu posso". |
| Sentimentos | 12 sentimentos; tocar mostra em tela cheia e fala a frase (voz do aparelho ou gravada). |
| Escala | 5 níveis de cor e "o que me ajuda" em cada nível, editável pela mãe. |
| Modo criança | Em qualquer quadro: esconde edição e menus; para sair é preciso segurar o cadeado. |
| Planos e pagamento | Checkout recorrente, cancelamento autenticado e sincronização de status via webhook do Mercado Pago em Supabase Edge Functions. O botão fica desativado até a implantação e configuração dos segredos. |
| Minha conta | Editar nome e dados da criança, ver o status da assinatura, ativar lembretes diários por push e sair. Solicitação de exclusão é encaminhada ao suporte. |
| Ajuda | WhatsApp (65) 99308-5010 com mensagem pronta. |
| Privacidade e termos | Rascunho com LGPD e dados de crianças (art. 14). Precisa de revisão jurídica. |
| Painel admin | Acesso limitado ao papel de administradora; indicadores ainda não estão ligados à interface. |

## Configuração do Supabase

1. O cadastro cria a conta no Supabase Auth; o trigger do esquema cria o perfil e inicia o teste de 7 dias.
2. Em **Authentication → URL Configuration**, configure `https://herculesfreire300.github.io/Rotina-Atipica/` como URL do site e inclua a mesma URL na lista de redirecionamentos permitidos. O link de recuperação de senha também retorna para esse endereço.
3. Em **Authentication → Providers → Email**, escolha se o e-mail precisa ser confirmado. Com confirmação ativa, a usuária deve confirmar a mensagem antes do primeiro login.
4. Para personalizar o remetente e os modelos de e-mail, configure um SMTP próprio em **Authentication → Emails → SMTP Settings**. O SMTP padrão do Supabase não permite personalizar os modelos e é limitado para uso em produção. O modelo em português de confirmação de cadastro está em `supabase/templates/confirm-sign-up.html`; em **Authentication → Emails → Templates → Confirm sign up**, defina o assunto `Confirme seu e-mail | Rotina Atípica` e cole o HTML do arquivo no corpo. Configure no SMTP o nome de remetente `Rotina Atípica` e um endereço de envio verificado no domínio escolhido.
5. As regras RLS controlam o acesso aos dados. A chave publicável do cliente não substitui RLS; nunca use uma chave secreta ou `service_role` no frontend.

O app exige conexão com o Supabase e não mantém uma cópia local da rotina. Estados antigos salvos pelo protótipo no `localStorage` não são importados automaticamente.
O PWA mantém em cache apenas os arquivos da interface para abrir a tela inicial quando estiver sem conexão; login, dados e mídias continuam dependendo de conexão com o Supabase.

## Ativação dos lembretes push

O horário pode ser escolhido em **Minha conta**. Os lembretes são diários e usam o fuso local do dispositivo; a notificação não inclui o nome nem dados da criança. Enquanto a configuração abaixo não estiver concluída, o botão fica desativado.

1. Aplique as migrações pendentes no projeto (incluindo `20260602000000_rotina_periods_reminders.sql` e `20260603000000_consultation_calendar.sql`) com `supabase db push` ou pelo SQL Editor.
2. Gere um par de chaves VAPID usando `npx web-push generate-vapid-keys`. Configure a chave pública em `vapidPublicKey` no arquivo `supabase-config.js`. Guarde a chave privada somente nos secrets do Supabase.
3. Configure os secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `REMINDER_CRON_SECRET` e `SUPABASE_SERVICE_ROLE_KEY` para as Edge Functions. Use como `VAPID_SUBJECT` a URL pública da plataforma. Crie um valor aleatório forte para `REMINDER_CRON_SECRET`; não o coloque no repositório nem no navegador.
4. Implante a função com `supabase functions deploy send-reminders`.
5. No painel do Supabase, habilite as extensões **pg_cron**, **pg_net** e **Supabase Vault**. Crie no Vault um segredo chamado `reminder_cron_secret` com o mesmo valor de `REMINDER_CRON_SECRET`.
6. Execute `supabase/schedules/send-reminders.sql` no SQL Editor para chamar a função a cada minuto. Confira os logs da Edge Function e do agendador antes de liberar o botão para usuários.
7. Publique o site atualizado. A pessoa ativa o lembrete em **Minha conta** e autoriza as notificações no navegador. No iPhone/iPad, é necessário adicionar o PWA à Tela de Início e abrir o app instalado antes de conceder a permissão.

O agendador registra no máximo um envio por conta e por dia local; todos os aparelhos que já autorizaram notificações nessa conta recebem o aviso. Usuárias podem desativar os lembretes em **Minha conta**. A recuperação de senha está implementada no app; o texto do e-mail seguirá o modelo configurado no Supabase e pode continuar em inglês até personalizar o template de redefinição e configurar SMTP próprio.

O calendário usa o mesmo serviço push: a migração de consultas cria as tabelas protegidas por RLS, e os lembretes de atendimento são habilitados separadamente em **Consultas e terapias**. Para cada atendimento futuro, o serviço envia um aviso aproximadamente 24 horas antes e outro 2 horas antes. Horários são guardados como instantes com fuso; a exibição segue o fuso atual do aparelho. O texto das notificações é genérico e não identifica criança, especialidade ou profissional na tela bloqueada.

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

## Áudios padrão com ElevenLabs

As falas padrão fixas podem ser geradas uma vez com a voz autorizada e armazenadas no bucket público `audio-padrao`. A reprodução usa os arquivos salvos e não chama o ElevenLabs nem consome créditos novamente. Textos personalizados (como nomes de passos) continuam usando a voz do aparelho, a menos que a família grave um áudio próprio. As gravações próprias ficam no bucket privado `midia` e não são substituídas.

1. Aplique `supabase/migrations/20260604000000_audio_padrao_publico.sql` para criar o bucket público somente de leitura.
2. Configure nos secrets do Supabase `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_ANON_KEY`. Use o ID da voz autorizada; nunca coloque a chave da API ou a `service_role` no frontend ou no repositório.
3. Implante a função com `supabase functions deploy gerar-audios-padrao`.
4. Entre no app com uma conta administradora, abra **Painel admin** e selecione **Preparar áudios padrão**. A função verifica quais arquivos já existem e só gera os ausentes; se houver uma falha parcial, pode ser executada novamente sem regenerar arquivos já salvos.
5. O bucket público contém apenas as falas fixas listadas pela função. Não envie nomes de crianças nem texto personalizado para essa geração.

## Pendências antes de lançar

- **Licença ARASAAC**: os pictogramas são CC BY-NC-SA, que não permite uso comercial. Para usar numa plataforma paga é preciso autorização do Governo de Aragão, ou usar outros pictogramas (ex.: emojis abertos como OpenMoji, desenhos próprios).
- Configurar e testar os redirecionamentos de autenticação no projeto Supabase.
- Implantar e testar as funções de pagamento do Mercado Pago e configurar os segredos diretamente no painel Supabase; os botões permanecem desativados até lá.
- Implementar exclusão autenticada da conta e dos objetos do Storage; até lá, o app encaminha solicitações ao suporte.
- Decidir como importar, com consentimento explícito, os dados legados que ainda estejam no navegador.
- Revisão jurídica dos textos de privacidade e termos.
