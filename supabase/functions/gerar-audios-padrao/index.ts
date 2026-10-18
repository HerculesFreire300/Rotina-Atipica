const corsHeaders = {
  "Access-Control-Allow-Origin": "https://herculesfreire300.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function requireUser(request: Request): Promise<{ id: string }> {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new HttpError(401, "Entre na sua conta para continuar.");
  }

  const response = await fetch(`${env("SUPABASE_URL")}/auth/v1/user`, {
    headers: { apikey: env("SUPABASE_ANON_KEY"), Authorization: authorization },
  });
  if (!response.ok) throw new HttpError(401, "A sessão expirou. Entre novamente.");
  const user = await response.json();
  if (!user || typeof user.id !== "string") {
    throw new HttpError(401, "A sessão não retornou uma conta válida.");
  }
  return { id: user.id };
}

const clips = [
  ["sentimento-feliz.mp3", "Estou feliz."],
  ["sentimento-triste.mp3", "Estou triste."],
  ["sentimento-raiva.mp3", "Estou com raiva."],
  ["sentimento-medo.mp3", "Estou com medo."],
  ["sentimento-cansado.mp3", "Estou cansado."],
  ["sentimento-cansada.mp3", "Estou cansada."],
  ["sentimento-calmo.mp3", "Estou calmo."],
  ["sentimento-calma.mp3", "Estou calma."],
  ["sentimento-animado.mp3", "Estou animado."],
  ["sentimento-animada.mp3", "Estou animada."],
  ["sentimento-confuso.mp3", "Estou confuso."],
  ["sentimento-confusa.mp3", "Estou confusa."],
  ["sentimento-dor.mp3", "Estou com dor."],
  ["sentimento-fome.mp3", "Estou com fome."],
  ["sentimento-barulho.mp3", "Está barulhento demais para mim."],
  ["sentimento-sozinho.mp3", "Quero ficar sozinho."],
  ["sentimento-sozinha.mp3", "Quero ficar sozinha."],
  ["espera-respirar.mp3", "Enquanto espero, posso respirar."],
  ["espera-bichinho.mp3", "Enquanto espero, posso abraçar meu bichinho."],
  ["espera-livro.mp3", "Enquanto espero, posso olhar um livro."],
  ["espera-desenhar.mp3", "Enquanto espero, posso desenhar."],
  ["espera-musica.mp3", "Enquanto espero, posso ouvir música."],
  ["espera-contar.mp3", "Enquanto espero, posso contar até dez."],
  ["espera-terminou.mp3", "A espera terminou."],
  ["rotina-terminou.mp3", "Pronto! A rotina terminou."],
] as const;

async function objectExists(filename: string, key: string, projectUrl: string): Promise<boolean> {
  const response = await fetch(
    `${projectUrl}/storage/v1/object/audio-padrao/${encodeURIComponent(filename)}`,
    { method: "HEAD", headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (response.ok) return true;
  if (response.status === 404) return false;
  throw new Error(`Não foi possível verificar o áudio (${response.status}).`);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  try {
    const user = await requireUser(request);
    const projectUrl = env("SUPABASE_URL");
    const elevenLabsKey = env("ELEVENLABS_API_KEY");
    const voiceId = env("ELEVENLABS_VOICE_ID");
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new HttpError(401, "Autenticação necessária.");
    const profileResponse = await fetch(
      `${projectUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role&limit=1`,
      { headers: { apikey: env("SUPABASE_ANON_KEY"), Authorization: authorization } },
    );
    if (!profileResponse.ok) {
      console.error("Admin profile lookup failed:", profileResponse.status);
      throw new HttpError(502, "Não foi possível validar a conta administradora.");
    }
    const profiles = await profileResponse.json() as Array<{ role: string }>;
    if (profiles[0]?.role !== "admin") {
      throw new HttpError(403, "Somente a administradora pode preparar os áudios.");
    }

    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    let generated = 0;
    let existing = 0;

    for (const [filename, text] of clips) {
      if (await objectExists(filename, serviceKey, projectUrl)) {
        existing += 1;
        continue;
      }

      const synthesis = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": elevenLabsKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.55, similarity_boost: 0.75 },
          }),
        },
      );
      if (!synthesis.ok) {
        console.error("ElevenLabs synthesis failed:", synthesis.status, filename);
        throw new HttpError(502, `A geração do áudio falhou (${synthesis.status}).`);
      }

      const upload = await fetch(
        `${projectUrl}/storage/v1/object/audio-padrao/${encodeURIComponent(filename)}`,
        {
          method: "POST",
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "audio/mpeg",
            "x-upsert": "false",
          },
          body: await synthesis.arrayBuffer(),
        },
      );
      if (!upload.ok) {
        console.error("Default audio upload failed:", upload.status, filename);
        throw new HttpError(502, `Não foi possível salvar o áudio (${upload.status}).`);
      }
      generated += 1;
    }

    return jsonResponse({ generated, existing, total: clips.length });
  } catch (error) {
    if (error instanceof HttpError) return jsonResponse({ error: error.message }, error.status);
    console.error("Default audio generation failed:", error);
    return jsonResponse({ error: "Não foi possível preparar os áudios padrão." }, 500);
  }
});
