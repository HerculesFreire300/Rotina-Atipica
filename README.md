# Rotina Atípica

Plataforma web (acessada pelo navegador, com conta de usuária) de rotina visual para mães de crianças autistas e atípicas. Funciona no celular, tablet e computador e pode ser instalada na tela inicial (PWA).

## O que já existe

- `prototipo/index.html`: protótipo navegável de todas as telas da v1. Os dados ficam só no navegador; login, pagamento e banco ainda são simulados.
- `schema.sql`: tabelas, regras de segurança (RLS), bucket de fotos e áudios, e funções do painel admin. Rode o conteúdo no SQL Editor do projeto Supabase antes de conectar o app.

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
| Planos e pagamento | Mensal R$ 14,90 e anual R$ 119,90; após 7 dias sem plano, os quadros ficam bloqueados (os dados continuam guardados). |
| Minha conta | Editar dados, ver assinatura, cancelar e apagar os dados (LGPD). |
| Ajuda | WhatsApp (65) 99308-5010 com mensagem pronta. |
| Privacidade e termos | Rascunho com LGPD e dados de crianças (art. 14). Precisa de revisão jurídica. |
| Painel admin | Totais, teste grátis, mensal, anual, cancelamentos, novas por dia e mês, faturamento e lista de usuárias. |

## Como o teste de 7 dias funciona (versão real)

1. No cadastro, o Supabase cria o perfil com `trial_ends_at = agora + 7 dias`.
2. A função `tem_acesso()` libera os quadros se o teste ainda vale ou se há assinatura `ativa`. As regras RLS impedem gravar dados sem acesso, então o bloqueio não depende só da tela.
3. Ao assinar, a usuária vai ao checkout de assinatura do Mercado Pago (preapproval).
4. O Mercado Pago chama um webhook (Supabase Edge Function `mp-webhook`), que confere a notificação na API do Mercado Pago e grava em `assinaturas` e `pagamentos`. Cancelou ou atrasou, o status muda e o acesso fecha sozinho.

## Estrutura de pastas proposta

```
rotina-atipica/
├── index.html              # casca da plataforma (SPA)
├── manifest.webmanifest    # PWA: nome, ícones, cores
├── sw.js                   # service worker: funciona offline
├── assets/
│   ├── css/app.css
│   ├── img/ (ícones, logo)
│   └── js/
│       ├── app.js          # rotas e estado
│       ├── supabase.js     # cliente, login, dados
│       ├── quadros/ rotina.js · espera.js · sentimentos.js · escala.js
│       ├── voz.js          # gravar e tocar áudios
│       ├── arasaac.js      # busca de pictogramas
│       └── admin.js
├── privacidade.html
├── termos.html
└── supabase/
    ├── schema.sql
    └── functions/
        ├── criar-assinatura/   # gera o link do Mercado Pago
        └── mp-webhook/         # recebe avisos do Mercado Pago
```

## Pendências antes de lançar

- **Licença ARASAAC**: os pictogramas são CC BY-NC-SA, que não permite uso comercial. Para usar numa plataforma paga é preciso autorização do Governo de Aragão, ou usar outros pictogramas (ex.: emojis abertos como OpenMoji, desenhos próprios).
- Criar o projeto no Supabase, a conta de vendedor no Mercado Pago e o repositório no GitHub (para o GitHub Pages e o domínio rotinaatipica.com.br).
- Revisão jurídica dos textos de privacidade e termos.
