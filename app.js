(function(){
const DAY=86400000;
const WA_NUM='5565993085010', WA_SHOW='(65) 99308-5010', WA_MSG='Olá, preciso de ajuda com o Rotina Atípica';
const WA_URL='https://wa.me/'+WA_NUM+'?text='+encodeURIComponent(WA_MSG);
const cfg=window.ROTINA_SUPABASE_CONFIG;
const sb=window.supabase&&cfg?window.supabase.createClient(cfg.url,cfg.publishableKey):null;
const paymentsEnabled=cfg?.paymentsEnabled===true;
let cloudUser=null,cloudProfile=null,cloudChild=null,cloudBoards={},cloudReady=false,saveQueue=Promise.resolve();
let mediaSlots=new Map(),mediaValues=new Map(),storedMediaPaths=new Set();
let paymentBusy=false;
function save(){
  if(!cloudReady||!S){toast('A conta ainda não está conectada. Tente novamente.');return}
  const snapshot=JSON.parse(JSON.stringify(S));
  saveQueue=saveQueue.then(()=>persistCloud(snapshot)).catch(e=>toast('Não foi possível salvar no Supabase: '+esc(e.message||e)));
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LOGO='<span class="logo" aria-hidden="true"><img src="logo-autismo.png" alt=""></span>';
const uid=()=>Math.random().toString(36).slice(2,9);

const LIB=[['Acordar','🌅'],['Ir ao banheiro','🚽'],['Lavar as mãos','🧼'],['Escovar os dentes','🪥'],['Tomar banho','🛁'],['Vestir a roupa','👕'],['Calçar o sapato','👟'],['Café da manhã','🥣'],['Escola','🏫'],['Carro','🚗'],['Almoço','🍽️'],['Brincar','🧸'],['Lanche','🍎'],['Terapia','🧩'],['Tablet','📱'],['Desenho','🖍️'],['Parque','🌳'],['Música','🎵'],['Ler história','📖'],['Jantar','🍲'],['Pijama','🌙'],['Dormir','😴'],['Médico','🩺'],['Mercado','🛒']];
const FEEL=[
 {id:'feliz',e:'😊',t:['Feliz','Feliz']},{id:'triste',e:'😢',t:['Triste','Triste']},{id:'raiva',e:'😠',t:['Com raiva','Com raiva']},
 {id:'medo',e:'😨',t:['Com medo','Com medo']},{id:'cansado',e:'🥱',t:['Cansado','Cansada']},{id:'calmo',e:'😌',t:['Calmo','Calma']},
 {id:'animado',e:'🤩',t:['Animado','Animada']},{id:'confuso',e:'😕',t:['Confuso','Confusa']},{id:'dor',e:'🤕',t:['Com dor','Com dor']},
 {id:'fome',e:'😋',t:['Com fome','Com fome']},{id:'barulho',e:'🙉',t:['Barulho demais','Barulho demais'],p:'Tem barulho demais'},
 {id:'sozinho',e:'🫧',t:['Quero ficar sozinho','Quero ficar sozinha'],p:true}];
const SCALE=[
 {n:1,c:'--s1',e:'😌',t:['Tranquilo','Tranquila'],h:['Continuar brincando','Receber um elogio']},
 {n:2,c:'--s2',e:'🙂',t:['Um pouco incomodado','Um pouco incomodada'],h:['Respirar fundo 3 vezes','Beber um copo de água']},
 {n:3,c:'--s3',e:'😐',t:['Incomodado','Incomodada'],h:['Abraçar o bichinho','Usar o fone contra barulho','Ir para o cantinho da calma']},
 {n:4,c:'--s4',e:'😣',t:['Muito nervoso','Muito nervosa'],h:['Ficar num lugar silencioso','Apertar a almofada','Adulto falando pouco e devagar']},
 {n:5,c:'--s5',e:'😫',t:['Explodindo','Explodindo'],h:['Ficar em segurança','Um adulto perto, em silêncio','Esperar passar, sem pressa']}];
const WAITOPTS=[['Respirar','🌬️'],['Bichinho','🧸'],['Livro','📖'],['Desenhar','🖍️'],['Música','🎵'],['Contar até 10','🔢']];

function fresh(u){
  return {user:u,createdAt:Date.now(),plan:null,planAt:null,
    routine:[['Acordar','🌅'],['Ir ao banheiro','🚽'],['Escovar os dentes','🪥'],['Café da manhã','🥣'],['Vestir a roupa','👕'],['Escola','🏫']].map(([t,e])=>({id:uid(),t,e,photo:null,audio:null,done:false})),
    waitMin:5,waitPick:null,feelAudio:{},helps:SCALE.map(s=>s.h.slice()),scalePick:3};
}

function failOnError(result){if(result.error)throw result.error;return result.data}
function dataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error||new Error('Não foi possível ler a mídia.'));reader.readAsDataURL(blob)})}
async function saveMedia(value,slot,paths){
  if(!value)return null;
  if(value.startsWith('storage://')){const path=value.slice(10);paths.add(path);return value}
  if(!value.startsWith('data:'))throw new Error('Formato de mídia não reconhecido.');
  if(mediaValues.get(slot)===value&&mediaSlots.has(slot)){paths.add(mediaSlots.get(slot));return 'storage://'+mediaSlots.get(slot)}
  const path=mediaSlots.get(slot)||`${cloudUser.id}/${slot}`;
  const blob=await (await fetch(value)).blob();
  failOnError(await sb.storage.from('midia').upload(path,blob,{upsert:true,contentType:blob.type}));
  mediaSlots.set(slot,path);mediaValues.set(slot,value);paths.add(path);
  return 'storage://'+path;
}
async function loadMedia(value,slot){
  if(!value||!value.startsWith('storage://'))return value||null;
  const path=value.slice(10);
  const {data,error}=await sb.storage.from('midia').download(path);
  if(error)throw error;
  mediaSlots.set(slot,path);storedMediaPaths.add(path);
  const loaded=await dataUrl(data);mediaValues.set(slot,loaded);return loaded;
}
async function persistCloud(state){
  if(!cloudUser||!cloudChild)throw new Error('A sessão da conta não está pronta.');
  failOnError(await sb.from('profiles').update({nome:state.user.name}).eq('id',cloudUser.id).select('id').single());
  if(!state.plan&&new Date(cloudProfile.trial_ends_at).getTime()<=Date.now())return;
  const mediaPaths=new Set(),routine=[];
  for(const item of state.routine){
    routine.push({...item,
      photo:await saveMedia(item.photo,`rotina/${item.id}/foto`,mediaPaths),
      audio:await saveMedia(item.audio,`rotina/${item.id}/audio`,mediaPaths)
    });
  }
  const feelAudio={};
  for(const [id,audio] of Object.entries(state.feelAudio||{}))
    feelAudio[id]=await saveMedia(audio,`sentimentos/${id}/audio`,mediaPaths);
  const configs={
    rotina:{routine},
    espera:{waitMin:state.waitMin,waitPick:state.waitPick},
    sentimentos:{feelAudio},
    escala:{helps:state.helps,scalePick:state.scalePick}
  };
  if(state.user.child!==cloudChild.nome||state.user.gender!==cloudChild.genero){
    failOnError(await sb.from('criancas').update({nome:state.user.child,genero:state.user.gender}).eq('id',cloudChild.id).select('id').single());
    cloudChild={...cloudChild,nome:state.user.child,genero:state.user.gender};
  }
  for(const [type,config] of Object.entries(configs)){
    const board=cloudBoards[type];
    if(!board)throw new Error('O quadro "'+type+'" não existe na conta.');
    failOnError(await sb.from('quadros').update({config}).eq('id',board.id).eq('user_id',cloudUser.id).select('id').single());
  }
  const obsolete=[...storedMediaPaths].filter(path=>!mediaPaths.has(path));
  if(obsolete.length)failOnError(await sb.storage.from('midia').remove(obsolete));
  for(const [slot,path] of mediaSlots)if(obsolete.includes(path)){mediaSlots.delete(slot);mediaValues.delete(slot)}
  storedMediaPaths=mediaPaths;
}
async function loadCloudState(user){
  cloudReady=false;cloudUser=user;cloudChild=null;cloudBoards={};mediaSlots=new Map();mediaValues=new Map();storedMediaPaths=new Set();
  const profile=failOnError(await sb.from('profiles').select('id,nome,email,role,trial_ends_at').eq('id',user.id).single());
  cloudProfile=profile;
  let child=failOnError(await sb.from('criancas').select('id,nome,genero').eq('user_id',user.id).order('created_at').limit(1).maybeSingle());
  if(!child){
    if(new Date(profile.trial_ends_at).getTime()<=Date.now())throw new Error('Não há perfil de criança nesta conta e o período de teste terminou. Fale com o suporte para liberar a configuração inicial.');
    const childName=user.user_metadata?.nome_crianca||'Criança';
    child=failOnError(await sb.from('criancas').insert({user_id:user.id,nome:childName,genero:user.user_metadata?.genero_crianca==='f'?'f':'m'}).select('id,nome,genero').single());
  }
  cloudChild=child;
  const rows=failOnError(await sb.from('quadros').select('id,tipo,nome,config').eq('user_id',user.id));
  for(const row of rows)cloudBoards[row.tipo]=row;
  const base=fresh({name:profile.nome||user.user_metadata?.nome||'Responsável',email:profile.email||user.email||'',child:child.nome,gender:child.genero});
  const initial={
    rotina:{routine:base.routine},
    espera:{waitMin:base.waitMin,waitPick:base.waitPick},
    sentimentos:{feelAudio:{}},
    escala:{helps:base.helps,scalePick:base.scalePick}
  };
  const names={rotina:'Rotina',espera:'Espera',sentimentos:'Sentimentos',escala:'Escala'};
  const missing=Object.keys(initial).filter(type=>!cloudBoards[type]);
  if(missing.length){
    const inserted=failOnError(await sb.from('quadros').insert(missing.map(tipo=>({user_id:user.id,crianca_id:child.id,tipo,nome:names[tipo],config:initial[tipo]}))).select('id,tipo,nome,config'));
    for(const row of inserted)cloudBoards[row.tipo]=row;
  }
  const subscriptions=failOnError(await sb.from('assinaturas').select('plano,status,created_at,periodo_fim,cancelada_em').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1));
  const subscription=subscriptions[0]||null;
  const active=subscription&&subscription.status==='ativa'&&subscription.periodo_fim&&new Date(subscription.periodo_fim).getTime()>Date.now()?subscription:null;
  const configs=Object.fromEntries(Object.entries(cloudBoards).map(([type,row])=>[type,row.config||{}]));
  S={...base,
    routine:Array.isArray(configs.rotina.routine)?configs.rotina.routine:base.routine,
    waitMin:Number(configs.espera.waitMin)||base.waitMin,
    waitPick:configs.espera.waitPick??null,
    feelAudio:configs.sentimentos.feelAudio||{},
    helps:Array.isArray(configs.escala.helps)?configs.escala.helps:base.helps,
    scalePick:Number(configs.escala.scalePick)||base.scalePick,
    plan:active?.plano||null,planAt:active?.created_at?new Date(active.created_at).getTime():null,subscription
  };
  for(const item of S.routine){
    item.photo=await loadMedia(item.photo,`rotina/${item.id}/foto`);
    item.audio=await loadMedia(item.audio,`rotina/${item.id}/audio`);
  }
  for(const [id,audio] of Object.entries(S.feelAudio))
    S.feelAudio[id]=await loadMedia(audio,`sentimentos/${id}/audio`);
  cloudReady=true;
  if(missing.length||!Array.isArray(configs.rotina.routine))await persistCloud(JSON.parse(JSON.stringify(S)));
}
function showStartupError(error){
  const root=document.getElementById('root');
  root.innerHTML=`<div class="card stack" style="max-width:620px;margin:12vh auto"><h1>Não foi possível conectar</h1><p class="muted">${esc(error.message||error)}</p><button class="btn primary" data-act="retry-load">Tentar novamente</button></div>`;
}
async function boot(){
  if(!sb){showStartupError(new Error('A configuração do Supabase não foi carregada. Atualize a página ou avise o suporte.'));return}
  try{
    const {data,error}=await sb.auth.getSession();
    if(error)throw error;
    if(data.session)await loadCloudState(data.session.user);
    render();
  }catch(error){showStartupError(error)}
}
if(sb)sb.auth.onAuthStateChange(event=>{
  if(event==='SIGNED_OUT'){S=null;cloudReady=false;cloudUser=null;cloudProfile=null;cloudChild=null;cloudBoards={};view='home';render()}
});
let S=null;
let view='home', kid=false, editing=false, modal=null, toastMsg='', toastT=0;

const gi=()=>S&&S.user.gender==='f'?1:0;
const daysLeft=()=>Math.max(0,Math.ceil((new Date(cloudProfile.trial_ends_at).getTime()-Date.now())/DAY));
const hasAccess=()=>!!S.plan||new Date(cloudProfile.trial_ends_at).getTime()>Date.now();
function feelPhrase(f){const w=f.t[gi()];if(f.p===true)return w;if(f.p)return f.p;return 'Estou '+w.charAt(0).toLowerCase()+w.slice(1)}

/* voz */
let voices=[];
function loadVoices(){try{voices=speechSynthesis.getVoices().filter(v=>/^pt/i.test(v.lang))}catch(e){}}
try{loadVoices();speechSynthesis.onvoiceschanged=loadVoices}catch(e){}
function tts(text){try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='pt-BR';u.rate=.9;const v=voices.find(v=>v.lang==='pt-BR')||voices[0];if(v)u.voice=v;speechSynthesis.speak(u)}catch(e){}}
function speak(text,audio){if(audio){const a=new Audio(audio);a.play().catch(()=>tts(text))}else tts(text)}
let actx=null;
function chime(){try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();[523.25,659.25,783.99].forEach((f,i)=>{const o=actx.createOscillator(),g=actx.createGain();o.type='sine';o.frequency.value=f;const t=actx.currentTime+i*.35;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.18,t+.05);g.gain.exponentialRampToValueAtTime(.001,t+1.2);o.connect(g).connect(actx.destination);o.start(t);o.stop(t+1.3)})}catch(e){}}

let recState=null;
async function startRec(onDone){
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    const mr=new MediaRecorder(stream),chunks=[];
    mr.ondataavailable=e=>chunks.push(e.data);
    mr.onstop=()=>{stream.getTracks().forEach(t=>t.stop());const b=new Blob(chunks,{type:mr.mimeType||'audio/webm'});const r=new FileReader();r.onload=()=>{recState=null;onDone(r.result)};r.readAsDataURL(b)};
    mr.start();recState={mr};render();
    setTimeout(()=>{if(recState&&recState.mr===mr)mr.stop()},15000);
  }catch(e){recState=null;toast('Não deu para usar o microfone aqui. Use "Escolher áudio".');render()}
}
function readFile(file,cb){if(!file)return;const r=new FileReader();r.onload=()=>cb(r.result);r.readAsDataURL(file)}
function readImage(file,cb){if(!file)return;const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{const m=360,s=Math.min(1,m/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=img.width*s;c.height=img.height*s;c.getContext('2d').drawImage(img,0,0,c.width,c.height);cb(c.toDataURL('image/jpeg',.82))};img.src=r.result};r.readAsDataURL(file)}

function toast(m){toastMsg=m;clearTimeout(toastT);toastT=setTimeout(()=>{toastMsg='';const el=document.querySelector('.toast');if(el)el.remove()},3200);const el=document.querySelector('.toast');if(el)el.textContent=m;else document.body.insertAdjacentHTML('beforeend','<div class="toast" role="status">'+esc(m)+'</div>')}
async function refreshSubscription(){
  const rows=failOnError(await sb.from('assinaturas').select('plano,status,created_at,periodo_fim,cancelada_em').eq('user_id',cloudUser.id).order('created_at',{ascending:false}).limit(1));
  S.subscription=rows[0]||null;
  const sub=S.subscription;
  S.plan=sub?.status==='ativa'&&sub.periodo_fim&&new Date(sub.periodo_fim).getTime()>Date.now()?sub.plano:null;
  S.planAt=S.plan&&sub?.created_at?new Date(sub.created_at).getTime():null;
}
async function startCheckout(plan){
  if(!paymentsEnabled){toast('O checkout ainda não foi ativado. Fale com o suporte para saber quando estará disponível.');return}
  if(paymentBusy)return;
  paymentBusy=true;render();
  try{
    const {data,error}=await sb.functions.invoke('criar-assinatura',{body:{plano:plan}});
    if(error)throw error;
    if(!data?.checkoutUrl)throw new Error(data?.error||'O checkout não foi iniciado. Tente novamente.');
    const checkout=new URL(data.checkoutUrl);
    if(checkout.protocol!=='https:'||!/(^|\.)mercadopago\.com(\.br)?$/i.test(checkout.hostname))throw new Error('O Mercado Pago retornou um endereço de checkout inválido.');
    window.location.assign(checkout.toString());
  }catch(error){paymentBusy=false;render();toast(error.message||'Não foi possível iniciar o pagamento.')}
}
async function cancelSubscription(){
  const pending=S.subscription?.status==='pendente';
  if(!window.confirm(pending?'Deseja cancelar este pagamento pendente?':'Deseja cancelar sua assinatura? O acesso seguirá disponível até o fim do período já pago.'))return;
  paymentBusy=true;render();
  try{
    const {data,error}=await sb.functions.invoke('cancelar-assinatura',{body:{}});
    if(error)throw error;
    await refreshSubscription();
    toast(pending?'Pagamento pendente cancelado.':'Assinatura cancelada. Você mantém o acesso até o fim do período pago.');
  }catch(error){toast(error.message||'Não foi possível cancelar a assinatura.')}
  finally{paymentBusy=false;render()}
}

const pic=(x,cls='')=>'<div class="pic '+cls+'" aria-hidden="true">'+(x.photo?'<img alt="" src="'+x.photo+'">':esc(x.e))+'</div>';

/* ---------- telas ---------- */
const NAV=[['home','🏠','Início'],['rotina','🗓️','Rotina'],['espera','⏳','Espera'],['sentimentos','💬','Sentimentos'],['escala','🌡️','Escala']];

function trialChip(){
  if(S.plan)return '<button class="chip ok" data-go="conta">Plano '+(S.plan==='anual'?'anual':'mensal')+' ativo</button>';
  const d=daysLeft();
  if(d<=0)return '<button class="chip warn" data-go="planos">Teste encerrado</button>';
  return '<button class="chip'+(d<=2?' warn':'')+'" data-go="planos">'+(d===1?'Último dia grátis':d+' dias grátis')+'</button>';
}

function viewWelcome(){
  return `<div class="welcome">
  <div class="stack" style="gap:22px">
    <div class="row">${LOGO}<strong style="font-family:var(--f-display);font-size:1.3rem">Rotina Atípica</strong></div>
    <h1>A rotina do seu filho, em <em>imagens</em> que ele entende.</h1>
    <p class="lead">Quadros visuais de rotina, espera e sentimentos para mães de crianças autistas e atípicas. No celular ou no computador.</p>
    <div class="preview" aria-hidden="true">
      <div class="nl now"><div class="tag">Agora</div><div class="pic">🪥</div><div class="name">Escovar os dentes</div></div>
      <div class="arrow">→</div><div class="nl later"><div class="tag">Depois</div><div class="pic">🥣</div><div class="name">Café da manhã</div></div>
    </div>
    <div class="feat"><span>🗓️ Rotina</span><span>⏳ Espera</span><span>💬 Sentimentos</span><span>🌡️ Escala da emoção</span><span>🎙️ Sua voz</span><span>📷 Suas fotos</span></div>
  </div>
  <div class="auth-panel">
  <form class="card stack signup" id="signup" novalidate>
    <div><h2>Comece seus 7 dias grátis</h2><p class="muted small">Sem cartão agora. Depois, R$ 14,90 por mês ou R$ 119,90 por ano.</p></div>
    <label class="field">Seu nome<input class="input" id="su-name" autocomplete="given-name" required placeholder="Ex.: Ana"></label>
    <label class="field">E-mail<input class="input" id="su-email" type="email" autocomplete="email" required placeholder="voce@email.com"></label>
    <label class="field">Crie uma senha<input class="input" id="su-pass" type="password" autocomplete="new-password" minlength="6" required placeholder="Mínimo 6 caracteres"></label>
    <label class="field">Nome ou apelido da criança<input class="input" id="su-child" required placeholder="Ex.: Theo"></label>
    <div class="field"><span>Para os textos dos cartões</span>
      <div class="seg" role="group" aria-label="Gênero da criança"><button type="button" id="su-m" data-gender="m" aria-pressed="true">Menino</button><button type="button" id="su-f" data-gender="f" aria-pressed="false">Menina</button></div></div>
    <label class="row small" style="align-items:flex-start;gap:10px;flex-wrap:nowrap"><input type="checkbox" id="su-terms" style="width:22px;height:22px;flex:none;margin-top:2px"><span>Li e aceito os <button type="button" class="linkish" data-legal="1" style="border:0;background:none;padding:0;color:var(--accent);font-weight:700;text-decoration:underline">termos de uso e a política de privacidade</button>.</span></label>
    <p class="small" id="su-err" style="color:var(--s5);font-weight:700" hidden></p>
    <button class="btn primary big block" type="submit">Criar conta e começar</button>
    <p class="muted small">Seus dados e sua senha ficam protegidos pelo Supabase.</p>
    <button class="btn ghost block" type="button" id="show-login">Já tenho uma conta — entrar</button>
  </form>
  <form class="card stack signup" id="login" novalidate hidden>
    <div><h2>Entrar na sua conta</h2><p class="muted small">Acesse sua rotina de qualquer dispositivo.</p></div>
    <label class="field">E-mail<input class="input" id="li-email" type="email" autocomplete="email" required placeholder="voce@email.com"></label>
    <label class="field">Senha<input class="input" id="li-pass" type="password" autocomplete="current-password" required></label>
    <p class="small" id="li-err" style="color:var(--s5);font-weight:700" hidden></p>
    <button class="btn primary big block" type="submit">Entrar</button>
    <button class="btn ghost block" type="button" id="show-signup">Criar uma conta</button>
  </form>
  </div></div>`;
}

function viewHome(){
  const next=S.routine.find(r=>!r.done), doneN=S.routine.filter(r=>r.done).length;
  const tiles=[['rotina','🗓️','Rotina','Agora, depois e o dia todo em imagens'],['espera','⏳','Espera','Timer visual e o que fazer enquanto isso'],['sentimentos','💬','Sentimentos','A criança mostra como está'],['escala','🌡️','Escala','O tamanho da emoção e o que ajuda']];
  return `<div class="hello"><div><p class="eyebrow">${new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</p><h1>Olá, ${esc(S.user.name)}</h1></div></div>
  ${trialBanner()}
  <div class="stack" style="gap:18px">
  <div class="card nextup">${next?pic(next)+`<div style="flex:1;min-width:0"><p class="eyebrow">Agora na rotina de ${esc(S.user.child)}</p><h2>${esc(next.t)}</h2><p class="muted small">${doneN} de ${S.routine.length} passos feitos hoje</p></div><button class="btn primary" data-go="rotina">Abrir</button>`:`<div class="pic">🌟</div><div style="flex:1"><h2>Rotina de hoje concluída</h2><p class="muted small">${esc(S.user.child)} fez todos os ${S.routine.length} passos.</p></div>`}</div>
  <div class="tiles">${tiles.map(([v,e,t,d])=>`<button class="tile v-${v}" data-go="${v}"><span class="emo" aria-hidden="true">${e}</span><h3>${t}</h3><p>${d}</p></button>`).join('')}</div>
  <div class="card help"><div style="min-width:0;flex:1 1 240px"><h3>Precisa de ajuda?</h3><p class="muted small">Fale com a gente pelo WhatsApp ${WA_SHOW}.</p></div><a class="btn ok" href="${WA_URL}" target="_blank" rel="noopener">💬 Chamar no WhatsApp</a></div>
  </div>`;
}

function trialBanner(){
  if(S.plan)return '';const d=daysLeft();
  if(d>2)return '';
  return `<div class="banner"><div><strong>${d===0?'Seu teste grátis terminou.':d===1?'Hoje é o último dia do teste grátis.':'Faltam 2 dias do teste grátis.'}</strong><p class="small">Veja as opções disponíveis para continuar usando os quadros de ${esc(S.user.child)}.</p></div><button class="btn primary" data-go="planos">Ver planos</button></div>`;
}

function kidBar(title){
  if(!kid)return `<div class="pagehead"><div class="ttl"><span class="badge" aria-hidden="true">${(NAV.find(n=>n[0]===view)||[])[1]||''}</span><h1>${title}</h1></div><div class="row">${extraTools()}<button class="btn primary" data-act="kid">Mostrar para a criança</button></div></div>`;
  return `<div class="kidbar"><h2>${title}</h2><button class="btn hold" id="holdexit" aria-label="Segure para sair do modo criança"><span class="fill"></span><span>🔒 Segure para sair</span></button></div>`;
}
function extraTools(){
  if(view==='rotina')return `<button class="btn" data-act="toggle-edit" aria-pressed="${editing}">${editing?'✓ Concluir edição':'✏️ Editar rotina'}</button>`;
  return '';
}

function viewRotina(){
  const pending=S.routine.filter(r=>!r.done), now=pending[0], later=pending[1];
  let top='';
  if(!S.routine.length)top=`<div class="card alldone"><div class="big">🗓️</div><h2>A rotina está vazia</h2><p class="muted">Adicione o primeiro passo do dia.</p><button class="btn primary" data-act="add-step">+ Adicionar passo</button></div>`;
  else if(!now)top=`<div class="card alldone"><div class="big">🌟</div><h2>Tudo pronto!</h2><p class="muted">Muito bem, ${esc(S.user.child)}.</p><div class="row" style="justify-content:center;margin-top:12px"><button class="btn" data-act="reset-day">↺ Recomeçar a rotina</button></div></div>`;
  else top=`<div class="nowlater">
    <div class="nl now"><div class="tag">Agora</div><button style="border:0;background:none;padding:0;width:100%;display:grid;place-items:center" data-say="${now.id}" aria-label="Ouvir: ${esc(now.t)}">${pic(now)}</button><div class="name">${esc(now.t)}</div>
      <div class="row" style="justify-content:center"><button class="btn" data-say="${now.id}">🔊 Ouvir</button><button class="btn ok big" data-done="${now.id}">✓ Feito!</button></div></div>
    <div class="arrow" aria-hidden="true">→</div>
    ${later?`<div class="nl later"><div class="tag">Depois</div><button style="border:0;background:none;padding:0;width:100%;display:grid;place-items:center" data-say="${later.id}" aria-label="Ouvir: ${esc(later.t)}">${pic(later)}</button><div class="name">${esc(later.t)}</div></div>`:`<div class="nl later"><div class="tag">Depois</div><div class="pic">🎉</div><div class="name">Acabou!</div></div>`}
  </div>`;
  const list=S.routine.map((r,i)=>`<div class="step${r.done?' done':''}">
    ${editing?'':`<button class="check" data-toggle="${r.id}" aria-pressed="${r.done}" aria-label="${r.done?'Desmarcar':'Marcar como feito'}: ${esc(r.t)}">${r.done?'✓':''}</button>`}
    ${pic(r)}<div class="t">${esc(r.t)}${r.audio?' <span class="muted small">🎙️</span>':''}</div>
    ${editing?`<button class="mini" data-up="${i}" aria-label="Subir" ${i===0?'disabled':''}>↑</button><button class="mini" data-down="${i}" aria-label="Descer" ${i===S.routine.length-1?'disabled':''}>↓</button><button class="mini" data-edit="${r.id}" aria-label="Editar">✏️</button>`:`<button class="mini" data-say="${r.id}" aria-label="Ouvir">🔊</button>`}
  </div>`).join('');
  return kidBar('Rotina de '+esc(S.user.child))+top+(kid?'':`<div class="stack" style="margin-top:26px"><div class="row" style="justify-content:space-between"><div style="flex:1;min-width:200px"><h3>Sequência do dia</h3><p class="muted small">${S.routine.filter(r=>r.done).length} de ${S.routine.length} feitos</p><div class="progress" style="margin-top:8px;max-width:320px"><span style="width:${S.routine.length?S.routine.filter(r=>r.done).length/S.routine.length*100:0}%"></span></div></div>${editing?'<button class="btn primary" data-act="add-step">+ Adicionar passo</button>':`<button class="btn ghost" data-act="reset-day">↺ Recomeçar</button>`}</div><div class="steps">${list}</div></div>`);
}

let T={total:300,left:300,running:false,last:0,iv:0,ended:false};
function setWait(min){T.total=min*60;T.left=T.total;T.running=false;T.ended=false;clearInterval(T.iv);S.waitMin=min;save()}
function viewEspera(){
  if(!T.running&&T.left===T.total&&T.total!==S.waitMin*60){T.total=S.waitMin*60;T.left=T.total}
  return kidBar('Hora de esperar')+`<div class="timerwrap">
   <div class="card stack" style="align-items:center">
    <div class="pie" id="pie" role="timer" style="--p:${T.left/T.total}"><div class="center"><div class="clock" id="clock">${fmt(T.left)}</div><div class="muted small" id="clocksub">${T.ended?'Acabou a espera!':T.running?'esperando…':'pronto para começar'}</div></div></div>
    ${kid?'':`<div class="seg" role="group" aria-label="Minutos">${[1,2,3,5,10,15].map(m=>`<button data-min="${m}" aria-pressed="${S.waitMin===m}">${m} min</button>`).join('')}</div>`}
    <div class="row" style="justify-content:center">${T.running?'<button class="btn big" data-act="pause">⏸ Pausar</button>':`<button class="btn primary big" data-act="start">▶ ${T.left<T.total&&!T.ended?'Continuar':'Começar'}</button>`}${kid?'':'<button class="btn big" data-act="reset-t">↺</button>'}</div>
   </div>
   <div class="card stack"><h3>Enquanto espero, eu posso:</h3>
    <div class="opts">${WAITOPTS.map(([t,e],i)=>`<button class="opt" data-wopt="${i}" aria-pressed="${S.waitPick===i}"><span class="e" aria-hidden="true">${e}</span>${t}</button>`).join('')}</div></div>
  </div>`;
}
const fmt=s=>{s=Math.ceil(s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
function tick(){
  const n=performance.now();T.left=Math.max(0,T.left-(n-T.last)/1000);T.last=n;
  const pie=document.getElementById('pie'),cl=document.getElementById('clock');
  if(pie)pie.style.setProperty('--p',T.left/T.total);if(cl)cl.textContent=fmt(T.left);
  if(T.left<=0){clearInterval(T.iv);T.running=false;T.ended=true;chime();setTimeout(()=>tts('Acabou a espera!'),1200);if(view==='espera')render()}
}

function viewSentimentos(){
  return kidBar('Como eu estou?')+`<div class="feel">${FEEL.map(f=>`<button class="fbtn k${({feliz:1,calmo:1,animado:1,triste:2,medo:2,cansado:4,confuso:4,sozinho:4,raiva:3,dor:3,fome:3,barulho:3})[f.id]}" data-feel="${f.id}"><span class="e" aria-hidden="true">${f.e}</span>${esc(f.t[gi()])}${S.feelAudio[f.id]?' <span class="small muted">🎙️</span>':''}</button>`).join('')}</div>
  ${kid?'':'<p class="muted small" style="margin-top:14px">Toque num sentimento para mostrar em tela cheia. Lá você também pode gravar sua voz para ele.</p>'}`;
}

function viewEscala(){
  const p=S.scalePick, L=SCALE[p-1];
  return kidBar('O tamanho da minha emoção')+`<div class="scale">
   <div class="thermo" role="group" aria-label="Escala de 1 a 5">${SCALE.slice().reverse().map(s=>`<button class="lvl" data-lvl="${s.n}" aria-pressed="${p===s.n}" style="background:var(${s.c})"><span class="n">${s.n}</span>${esc(s.t[gi()])}<span class="e" aria-hidden="true">${s.e}</span></button>`).join('')}</div>
   <div class="card stack lvlcard" style="--lc:var(${L.c})">
     <div class="row"><span style="font-size:3rem" aria-hidden="true">${L.e}</span><div><p class="eyebrow">Nível ${L.n}</p><h2>${esc(L.t[gi()])}</h2></div></div>
     <h3>O que me ajuda</h3>
     <ul class="helps">${S.helps[p-1].map(h=>`<li>${esc(h)}</li>`).join('')||'<li class="muted">Nada cadastrado ainda</li>'}</ul>
     <div class="row"><button class="btn" data-act="say-lvl">🔊 Ouvir</button>${kid?'':'<button class="btn ghost" data-act="edit-helps">✏️ Editar o que ajuda</button>'}</div>
   </div></div>`;
}

function viewPlanos(){
  const d=daysLeft();
  const sub=S.subscription;
  const paymentPending=sub?.status==='pendente';
  const planBlocked=!paymentsEnabled||!!S.plan||paymentPending||sub?.status==='pausada'||paymentBusy;
  const button=(plan,label)=>`<button class="btn ${plan==='anual'?'primary ':''}block big" data-act="checkout-${plan}" ${planBlocked?'disabled':''}>${paymentBusy?'Abrindo checkout…':S.plan===plan?'Plano atual':paymentPending?'Pagamento pendente':sub?.status==='pausada'?'Assinatura pausada':paymentsEnabled?label:'Pagamento em ativação'}</button>`;
  return `<div class="stack" style="gap:20px"><div><h1>Planos</h1><p class="muted">${S.plan?'Você já é assinante. Obrigada por apoiar o Rotina Atípica.':d>0?`Você ainda tem ${d} ${d===1?'dia':'dias'} de teste grátis.`:'Seu teste grátis terminou; seus dados continuam guardados.'}</p></div>
  <div class="plans">
   <div class="card plan stack"><div><p class="eyebrow">Mensal</p><p class="price">R$ 14,90<span class="muted small" style="font-family:var(--f-body)"> /mês</span></p></div>
     <ul class="ticks"><li>Todos os quadros</li><li>Fotos e voz própria nos cartões</li><li>Celular, tablet e computador</li><li>Cancele quando quiser</li></ul>
     ${button('mensal','Assinar plano mensal')}</div>
   <div class="card plan best stack"><div class="row" style="justify-content:space-between"><p class="eyebrow">Anual</p><span class="chip ok">Economize 33%</span></div><div><p class="price">R$ 119,90<span class="muted small" style="font-family:var(--f-body)"> /ano</span></p><p class="muted small">Equivale a R$ 9,99 por mês</p></div>
     <ul class="ticks"><li>Tudo do plano mensal</li><li>R$ 58,90 a menos no ano</li><li>Uma cobrança por ano</li></ul>
     ${button('anual','Assinar plano anual')}</div>
  </div>
  <p class="muted small">${paymentsEnabled?'O pagamento é processado com segurança pelo Mercado Pago.':'O checkout será habilitado após a configuração segura do Mercado Pago.'} Dúvidas: <a href="${WA_URL}" target="_blank" rel="noopener">WhatsApp ${WA_SHOW}</a>.</p></div>`;
}
function viewPaywall(){
  return `<div class="card stack" style="max-width:620px;margin:20px auto;text-align:center;align-items:center"><div style="font-size:4rem">🔒</div><h1>O teste grátis terminou</h1>
  <p class="muted">A rotina de ${esc(S.user.child)} continua guardada. ${paymentsEnabled?'Assine um plano para continuar usando os quadros.':'Os pagamentos ainda estão sendo configurados; fale com o suporte para saber quando o acesso poderá ser retomado.'}</p>
  <div class="row" style="justify-content:center">${paymentsEnabled?'<button class="btn primary" data-go="planos">Ver planos</button>':''}<a class="btn" href="${WA_URL}" target="_blank" rel="noopener">💬 Falar com a gente</a></div></div>`;
}

function viewAjuda(){
  return `<div class="stack" style="max-width:640px"><h1>Ajuda</h1>
  <div class="card stack"><h3>WhatsApp</h3><p>Atendimento pelo número <strong style="user-select:all">${WA_SHOW}</strong>. A mensagem já vai pronta: “${WA_MSG}”.</p>
   <div class="row"><a class="btn ok big" href="${WA_URL}" target="_blank" rel="noopener">💬 Abrir WhatsApp</a><button class="btn" data-act="copy-wa">Copiar número</button></div></div>
  <div class="card stack"><h3>Perguntas comuns</h3>
   <p><strong>Como gravo minha voz num cartão?</strong><br><span class="muted">Na Rotina, toque em “Editar rotina”, depois no lápis do passo e em “Gravar agora”. No celular, “Escolher áudio” também abre o gravador.</span></p>
   <p><strong>A criança pode mexer sem bagunçar?</strong><br><span class="muted">Sim. Use “Mostrar para a criança”: os botões de edição somem e, para sair, é preciso segurar o cadeado.</span></p>
   <p><strong>O que acontece depois dos 7 dias?</strong><br><span class="muted">Seus quadros continuam guardados. ${paymentsEnabled?'Escolha um plano para continuar usando a plataforma.':'A cobrança ainda está sendo configurada; fale com o suporte para saber sobre a retomada do acesso.'}</span></p></div></div>`;
}

function viewPrivacidade(){
  return `<div class="stack legal"><h1>Privacidade e termos</h1><p class="muted small">Versão de rascunho para revisão jurídica antes do lançamento.</p>
  <div class="card stack">
  <h3>Que dados coletamos</h3><p>Da responsável: nome, e-mail e senha (guardada de forma criptografada). Da criança: apenas o nome ou apelido e, se você quiser, fotos e gravações de voz colocadas nos cartões. Não pedimos data de nascimento, diagnóstico, escola ou documentos.</p>
  <h3>Para que usamos</h3><p>Somente para fazer os quadros funcionarem e para controlar a assinatura. Não vendemos nem compartilhamos dados para publicidade.</p>
  <h3>Dados de crianças (LGPD, art. 14)</h3><p>Os dados da criança são tratados no melhor interesse dela e com o consentimento da mãe, pai ou responsável legal, dado no cadastro. Fotos e áudios ficam visíveis só para a sua conta.</p>
  <h3>Pagamentos</h3><p>${paymentsEnabled?'Os pagamentos são processados pelo Mercado Pago; o Rotina Atípica não recebe nem guarda o número do cartão.':'A integração de pagamentos ainda não está ativa. Quando estiver disponível, os dados do cartão serão tratados pelo Mercado Pago; o Rotina Atípica não receberá nem guardará o número do cartão.'}</p>
  <h3>Seus direitos</h3><p>Você pode ver, corrigir, baixar ou apagar seus dados e os da criança a qualquer momento, em “Minha conta” ou pelo WhatsApp ${WA_SHOW}.</p>
  <h3>Termos de uso</h3><p>O Rotina Atípica é uma ferramenta de apoio à organização da rotina e não substitui acompanhamento terapêutico ou médico. O teste grátis dura 7 dias a partir do cadastro. As opções de assinatura e cobrança ainda estão em configuração.</p>
  <h3>Pictogramas</h3><p>Nesta demonstração os cartões usam emojis. A versão final pode usar pictogramas ARASAAC, com o crédito exigido: “Autor dos pictogramas: Sergio Palao. Origem: ARASAAC (arasaac.org). Licença: CC BY-NC-SA. Propriedade: Governo de Aragão (Espanha)”.</p>
  </div></div>`;
}

function viewConta(){
  return `<div class="stack" style="max-width:640px"><h1>Minha conta</h1>
  <div class="card stack"><label class="field">Seu nome<input class="input" id="ac-name" value="${esc(S.user.name)}"></label>
   <label class="field">E-mail<input class="input" id="ac-email" type="email" value="${esc(S.user.email)}" readonly></label>
   <label class="field">Nome da criança<input class="input" id="ac-child" value="${esc(S.user.child)}" ${hasAccess()?'':'readonly'}></label>
   <div class="seg" role="group" aria-label="Gênero da criança"><button type="button" id="ac-m" data-g2="m" aria-pressed="${!gi()}" ${hasAccess()?'':'disabled'}>Menino</button><button type="button" id="ac-f" data-g2="f" aria-pressed="${!!gi()}" ${hasAccess()?'':'disabled'}>Menina</button></div>
   <button class="btn primary" data-act="save-acct">Salvar</button></div>
  <div class="card stack"><h3>Assinatura</h3><p>${S.plan?`Plano ${S.plan}, desde ${new Date(S.planAt).toLocaleDateString('pt-BR')}.`:daysLeft()>0?`Teste grátis: ${daysLeft()} ${daysLeft()===1?'dia restante':'dias restantes'}.`:'Teste grátis encerrado.'}</p>
   ${S.subscription?.status==='pendente'?'<p class="muted small">Aguardando confirmação do Mercado Pago.</p><button class="btn" data-act="refresh-subscription">Atualizar status</button>':''}
   ${S.subscription?.status==='pausada'?'<p class="muted small">Sua assinatura está pausada. Entre em contato com o suporte para retomá-la ou cancelá-la.</p>':''}
   ${S.plan&&S.subscription?.cancelada_em?`<p class="muted small">Cancelamento solicitado. Seu acesso continua até ${S.subscription.periodo_fim?new Date(S.subscription.periodo_fim).toLocaleDateString('pt-BR'):'o fim do período pago'}.</p>`:''}
   ${(S.plan&&!S.subscription?.cancelada_em)||S.subscription?.status==='pendente'?`<button class="btn danger" data-act="cancel-subscription" ${paymentBusy?'disabled':''}>${S.subscription?.status==='pendente'?'Cancelar pagamento pendente':'Cancelar assinatura'}</button>`:''}
   ${!S.plan&&S.subscription?.status!=='pendente'&&S.subscription?.status!=='pausada'?'<button class="btn primary" data-go="planos">Ver planos</button>':''}</div>
  <div class="card stack"><h3>Mais</h3><div class="row"><button class="btn" data-go="ajuda">Ajuda</button><button class="btn" data-go="privacidade">Privacidade e termos</button><button class="btn" data-go="admin">Painel admin</button></div></div>
  <div class="card stack"><h3>Apagar meus dados</h3><p class="muted small">A exclusão automática da conta e dos arquivos ainda não está configurada. Peça a exclusão pelo canal de suporte para que seus dados sejam removidos corretamente.</p>
   <a class="btn danger" href="${WA_URL}" target="_blank" rel="noopener">Solicitar exclusão pelo WhatsApp</a></div>
  <div class="row"><button class="btn ghost" data-act="sign-out">Sair da conta</button></div></div>`;
}

function viewAdmin(){
  if(cloudProfile.role!=='admin')return `<div class="card stack" style="max-width:520px"><p class="eyebrow">Área restrita</p><h2>Painel do administrador</h2><p class="muted">Esta conta não tem permissão de administradora.</p></div>`;
  return `<div class="card stack" style="max-width:620px"><p class="eyebrow">Área administrativa</p><h1>Painel admin</h1><p class="muted">O banco está protegido e a função de resumo está pronta. Os indicadores do painel ainda não estão conectados à interface.</p></div>`;
}

/* ---------- modais ---------- */
function modalHTML(){
  if(!modal)return '';
  if(modal.type==='feel'){const f=FEEL.find(x=>x.id===modal.id);const a=S.feelAudio[f.id];
    return `<div class="overlay" data-close="1"><div class="bigshow" role="dialog" aria-modal="true" aria-label="${esc(feelPhrase(f))}"><div class="e" aria-hidden="true">${f.e}</div><div class="t">${esc(feelPhrase(f))}</div>
     <div class="row" style="justify-content:center"><button class="btn big" data-act="say-feel">🔊 Ouvir</button><button class="btn primary big" data-act="close">Pronto</button></div>
     ${kid?'':`<div class="row small" style="justify-content:center">${recButtons('feel')}${a?'<button class="btn ghost" data-act="del-feel-audio">Usar voz do aparelho</button>':''}</div>`}</div></div>`}
  if(modal.type==='step'){const d=modal.d;
    return `<div class="overlay"><div class="sheet" role="dialog" aria-modal="true" aria-label="Passo da rotina"><div class="row" style="justify-content:space-between"><h2>${modal.isNew?'Novo passo':'Editar passo'}</h2><button class="iconbtn" data-act="close" aria-label="Fechar">✕</button></div>
     <div class="row">${pic(d,'')}<label class="field" style="flex:1;min-width:0">Nome do passo<input class="input" id="st-title" value="${esc(d.t)}" placeholder="Ex.: Escovar os dentes"></label></div>
     <div class="stack" style="gap:8px"><span class="eyebrow">Escolha uma imagem</span><div class="emogrid">${LIB.map(([t,e])=>`<button data-pick="${e}" data-pickt="${esc(t)}" aria-label="${esc(t)}" aria-pressed="${!d.photo&&d.e===e}" title="${esc(t)}">${e}</button>`).join('')}</div></div>
     <div class="row"><label class="btn filebtn">📷 Usar foto própria<input type="file" id="st-photo" accept="image/*"></label>${d.photo?'<button class="btn ghost" data-act="del-photo">Tirar foto</button>':''}</div>
     <div class="stack" style="gap:8px"><span class="eyebrow">Sua voz neste cartão ${d.audio?'· gravada ✓':''}</span><div class="row">${recButtons('step')}${d.audio?'<button class="btn ghost" data-act="play-draft">▶ Ouvir</button><button class="btn ghost" data-act="del-audio">Apagar</button>':''}</div></div>
     <div class="row" style="justify-content:space-between">${modal.isNew?'<span></span>':'<button class="btn danger" data-act="del-step">Excluir passo</button>'}<button class="btn primary big" data-act="save-step">Salvar</button></div></div></div>`}
  if(modal.type==='helps'){
    return `<div class="overlay"><div class="sheet" role="dialog" aria-modal="true" aria-label="O que ajuda"><div class="row" style="justify-content:space-between"><h2>Nível ${S.scalePick}: o que ajuda</h2><button class="iconbtn" data-act="close" aria-label="Fechar">✕</button></div>
     <label class="field">Uma ideia por linha<textarea class="input" id="hp-text">${esc(S.helps[S.scalePick-1].join('\n'))}</textarea></label>
     <button class="btn primary big" data-act="save-helps">Salvar</button></div></div>`}
  return '';
}
function recButtons(ctx){
  if(recState)return `<button class="btn danger" data-act="stop-rec"><span class="rec"></span> Parar gravação</button>`;
  return `<button class="btn" data-act="rec-${ctx}">🎙️ Gravar agora</button><label class="btn ghost filebtn">Escolher áudio<input type="file" id="aud-${ctx}" accept="audio/*" capture></label>`;
}

/* ---------- render ---------- */
function render(){
  const root=document.getElementById('root');
  document.documentElement.classList.toggle('kid',kid);
  if(!S){root.innerHTML=viewWelcome()+(modal&&modal.type==='legal'?legalModal():'');bindSignup();return}
  const locked=['rotina','espera','sentimentos','escala'].includes(view)&&!hasAccess();
  const body=locked?viewPaywall():({home:viewHome,rotina:viewRotina,espera:viewEspera,sentimentos:viewSentimentos,escala:viewEscala,planos:viewPlanos,ajuda:viewAjuda,privacidade:viewPrivacidade,conta:viewConta,admin:viewAdmin}[view]||viewHome)();
  const navBtn=([v,i,l],cls)=>`<button class="${cls}" data-go="${v}" ${view===v?'aria-current="page"':''}><span class="i" aria-hidden="true">${i}</span>${l}</button>`;
  root.innerHTML=`<div class="shell">
   <nav class="side" aria-label="Menu"><button class="brand" data-go="home">${LOGO}Rotina Atípica</button>
    ${NAV.map(n=>navBtn(n,'nav')).join('')}<div class="sep"></div>
    ${[['planos','⭐','Planos'],['ajuda','💬','Ajuda'],['conta','👤','Minha conta'],['admin','📊','Painel admin']].map(n=>navBtn(n,'nav')).join('')}
    <div style="margin-top:auto;padding:8px">${trialChip()}</div></nav>
   <main class="main v-${view}">${kid?'':`<div class="top"><button class="brand" data-go="home">${LOGO}Rotina Atípica</button><div class="row" style="margin-left:auto">${trialChip()}<button class="iconbtn" data-go="conta" aria-label="Minha conta">👤</button></div></div>`}${body}</main>
   <nav class="bottom" aria-label="Menu">${NAV.map(n=>navBtn(n,'')).join('')}</nav></div>${modalHTML()}${toastMsg?`<div class="toast" role="status">${esc(toastMsg)}</div>`:''}`;
  bindHold();
}
function legalModal(){return `<div class="overlay" data-close="1"><div class="sheet" role="dialog" aria-modal="true">${viewPrivacidade()}<button class="btn primary big" data-act="close">Fechar</button></div></div>`}

let suGender='m';
function bindSignup(){
  const signup=document.getElementById('signup'),login=document.getElementById('login');if(!signup||!login)return;
  const show=(isLogin)=>{
    signup.hidden=isLogin;login.hidden=!isLogin;
    (isLogin?document.getElementById('li-email'):document.getElementById('su-name')).focus();
  };
  document.getElementById('show-login').addEventListener('click',()=>show(true));
  document.getElementById('show-signup').addEventListener('click',()=>show(false));
  signup.addEventListener('submit',async e=>{e.preventDefault();
    const v=id=>document.getElementById(id).value.trim(), err=document.getElementById('su-err');
    let m='';
    if(!v('su-name'))m='Escreva seu nome.';else if(!/^\S+@\S+\.\S+$/.test(v('su-email')))m='Confira o e-mail. Ele precisa ter @ e um domínio, como voce@email.com.';
    else if(v('su-pass').length<6)m='A senha precisa ter pelo menos 6 caracteres.';else if(!v('su-child'))m='Escreva o nome ou apelido da criança.';
    else if(!document.getElementById('su-terms').checked)m='Para continuar, aceite os termos e a política de privacidade.';
    if(m){err.textContent=m;err.hidden=false;return}
    const button=signup.querySelector('[type=submit]');button.disabled=true;err.hidden=true;
    try{
      const {data,error}=await sb.auth.signUp({email:v('su-email'),password:v('su-pass'),options:{emailRedirectTo:'https://herculesfreire300.github.io/Rotina-Atipica/',data:{nome:v('su-name'),nome_crianca:v('su-child'),genero_crianca:suGender}}});
      if(error)throw error;
      if(data.session){await loadCloudState(data.session.user);view='home';render();toast('Conta criada. Seus 7 dias grátis começaram hoje.')}
      else{
        document.getElementById('li-email').value=v('su-email');
        show(true);
        const status=document.getElementById('li-err');status.style.color='var(--accent)';status.textContent='Conta criada. Confirme o endereço pelo link enviado ao seu e-mail e depois entre aqui.';status.hidden=false;
      }
    }catch(error){err.textContent=error.message||'Não foi possível criar a conta.';err.hidden=false}
    finally{button.disabled=false}
  });
  login.addEventListener('submit',async e=>{
    e.preventDefault();
    const button=login.querySelector('[type=submit]'),err=document.getElementById('li-err');
    button.disabled=true;err.style.color='var(--s5)';err.hidden=true;
    try{
      const {data,error}=await sb.auth.signInWithPassword({email:document.getElementById('li-email').value.trim(),password:document.getElementById('li-pass').value});
      if(error)throw error;
      await loadCloudState(data.user);view='home';render();toast('Bem-vinda de volta.');
    }catch(error){err.textContent=error.message||'Não foi possível entrar.';err.hidden=false}
    finally{button.disabled=false}
  });
}
function bindHold(){
  const b=document.getElementById('holdexit');if(!b)return;
  let t=0,st=0,raf=0;const fill=b.querySelector('.fill');
  const stop=()=>{cancelAnimationFrame(raf);fill.style.transform='scaleX(0)'};
  const step=()=>{const p=Math.min(1,(performance.now()-st)/1500);fill.style.transform='scaleX('+p+')';if(p>=1){kid=false;render();return}raf=requestAnimationFrame(step)};
  b.addEventListener('pointerdown',e=>{e.preventDefault();st=performance.now();step()});
  ['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,stop));
  b.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.repeat){st=performance.now();step()}});
  b.addEventListener('keyup',stop);
}

/* ---------- eventos ---------- */
document.addEventListener('click',e=>{
  const el=e.target.closest('button,[data-close]');if(!el)return;
  if(el.matches('[data-close]')&&e.target!==el)return;
  const d=el.dataset;
  if(d.close){modal=null;render();return}
  if(d.legal){modal={type:'legal'};render();return}
  if(d.gender){suGender=d.gender;document.querySelectorAll('[data-gender]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.gender===suGender));return}
  if(d.act==='retry-load'){boot();return}
  if(!S)return;
  if(d.g2){S.user.gender=d.g2;save();render();return}
  if(d.go){view=d.go;editing=false;modal=null;render();window.scrollTo(0,0);return}
  if(d.say){const r=S.routine.find(x=>x.id===d.say);if(r)speak(r.t,r.audio);return}
  if(d.done){const r=S.routine.find(x=>x.id===d.done);r.done=true;save();const nx=S.routine.find(x=>!x.done);speak(nx?'Muito bem! Agora: '+nx.t:'Muito bem! Acabou a rotina.');render();return}
  if(d.toggle){const r=S.routine.find(x=>x.id===d.toggle);r.done=!r.done;save();render();return}
  if(d.up||d.down){const i=+(d.up??d.down),j=d.up!==undefined?i-1:i+1;[S.routine[i],S.routine[j]]=[S.routine[j],S.routine[i]];save();render();return}
  if(d.edit){const r=S.routine.find(x=>x.id===d.edit);modal={type:'step',d:{...r},isNew:false};render();return}
  if(d.pick){modal.d.t=document.getElementById('st-title').value||'';if(!modal.d.t||LIB.some(([t])=>t===modal.d.t))modal.d.t=d.pickt;modal.d.e=d.pick;modal.d.photo=null;render();return}
  if(d.min){setWait(+d.min);render();return}
  if(d.wopt){S.waitPick=+d.wopt;save();tts('Enquanto espero, eu posso: '+WAITOPTS[+d.wopt][0]);render();return}
  if(d.feel){modal={type:'feel',id:d.feel};const f=FEEL.find(x=>x.id===d.feel);render();speak(feelPhrase(f),S.feelAudio[f.id]);return}
  if(d.lvl){S.scalePick=+d.lvl;save();render();return}
  const a=d.act;if(!a)return;
  ({
   'kid':()=>{kid=true;editing=false;render();window.scrollTo(0,0)},
   'toggle-edit':()=>{editing=!editing;render()},
   'add-step':()=>{modal={type:'step',d:{id:uid(),t:'',e:'⭐',photo:null,audio:null,done:false},isNew:true};render()},
   'reset-day':()=>{S.routine.forEach(r=>r.done=false);save();render()},
   'close':()=>{if(recState)recState.mr.stop();modal=null;render()},
   'save-step':()=>{const t=document.getElementById('st-title').value.trim();if(!t){toast('Dê um nome para o passo.');return}modal.d.t=t;if(modal.isNew)S.routine.push(modal.d);else{const i=S.routine.findIndex(x=>x.id===modal.d.id);S.routine[i]=modal.d}save();modal=null;render();toast('Passo salvo.')},
   'del-step':()=>{S.routine=S.routine.filter(x=>x.id!==modal.d.id);save();modal=null;render();toast('Passo excluído.')},
   'del-photo':()=>{modal.d.photo=null;render()},
   'del-audio':()=>{modal.d.audio=null;render()},
   'play-draft':()=>speak(modal.d.t,modal.d.audio),
   'rec-step':()=>{modal.d.t=document.getElementById('st-title').value;startRec(u=>{modal.d.audio=u;render();toast('Voz gravada.')})},
   'rec-feel':()=>startRec(u=>{S.feelAudio[modal.id]=u;save();render();toast('Voz gravada para este sentimento.')}),
   'stop-rec':()=>{if(recState)recState.mr.stop()},
   'say-feel':()=>{const f=FEEL.find(x=>x.id===modal.id);speak(feelPhrase(f),S.feelAudio[f.id])},
   'del-feel-audio':()=>{delete S.feelAudio[modal.id];save();render()},
   'start':()=>{if(T.ended||T.left<=0){T.left=T.total;T.ended=false}T.running=true;T.last=performance.now();clearInterval(T.iv);T.iv=setInterval(tick,250);try{actx=actx||new (window.AudioContext||window.webkitAudioContext)()}catch(e){}render()},
   'pause':()=>{tick();clearInterval(T.iv);T.running=false;render()},
   'reset-t':()=>{setWait(S.waitMin);render()},
   'say-lvl':()=>{const L=SCALE[S.scalePick-1];tts('Nível '+L.n+'. '+L.t[gi()]+'. O que me ajuda: '+S.helps[L.n-1].join(', '))},
   'edit-helps':()=>{modal={type:'helps'};render()},
   'save-helps':()=>{S.helps[S.scalePick-1]=document.getElementById('hp-text').value.split('\n').map(s=>s.trim()).filter(Boolean);save();modal=null;render();toast('Salvo.')},
   'save-acct':()=>{const v=id=>document.getElementById(id).value.trim();S.user.name=v('ac-name')||S.user.name;if(hasAccess())S.user.child=v('ac-child')||S.user.child;save();render();toast('Dados salvos.')},
   'checkout-mensal':()=>startCheckout('mensal'),
   'checkout-anual':()=>startCheckout('anual'),
   'cancel-subscription':()=>cancelSubscription(),
   'refresh-subscription':async()=>{try{await refreshSubscription();render();toast('Status da assinatura atualizado.')}catch(error){toast('Não foi possível atualizar: '+esc(error.message||error))}},
   'sign-out':async()=>{try{await saveQueue;const {error}=await sb.auth.signOut();if(error)throw error}catch(error){toast('Não foi possível sair: '+esc(error.message||error))}},
   'copy-wa':()=>{navigator.clipboard.writeText(WA_SHOW).then(()=>toast('Número copiado.')).catch(()=>toast('Selecione o número para copiar.'))},
  }[a]||(()=>{}))();
});
document.addEventListener('change',e=>{
  const t=e.target,f=t.files&&t.files[0];if(!f)return;
  if(t.id==='st-photo'){modal.d.t=document.getElementById('st-title').value;readImage(f,u=>{modal.d.photo=u;render()})}
  if(t.id==='aud-step'){modal.d.t=document.getElementById('st-title').value;readFile(f,u=>{modal.d.audio=u;render();toast('Áudio adicionado.')})}
  if(t.id==='aud-feel'){readFile(f,u=>{S.feelAudio[modal.id]=u;save();render();toast('Áudio adicionado.')})}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal){modal=null;render()}});
boot();
})();
