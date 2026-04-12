const ALLOWED_ORIGINS = [
  'https://app.pomocare.com',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:5174',
  'https://localhost',
  'capacitor://localhost',
];

export function corsHeaders(origin: string): Record<string, string> {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

export function handleCors(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('Origin') ?? '';
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  return null;
}

export function jsonResponse(
  data: unknown,
  status: number,
  origin: string,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}
