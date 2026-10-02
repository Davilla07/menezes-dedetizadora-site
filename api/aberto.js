// Aviso de abertura da página via ntfy.sh (push no celular do Inacio).
// Só funciona com a variável de ambiente NTFY_TOPIC configurada na Vercel; sem ela, não faz nada.
// Não guarda nada e não envia IP: só horário, cidade aproximada (geo da Vercel) e tipo de aparelho.

const BOTS = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|headless|lighthouse/i;

function aparelho(ua) {
  const so = /iphone|ipad/i.test(ua) ? 'iPhone/iPad'
    : /android/i.test(ua) ? 'Android'
    : /windows/i.test(ua) ? 'Windows'
    : /mac os/i.test(ua) ? 'Mac'
    : 'outro';
  const app = /instagram/i.test(ua) ? ' (navegador do Instagram)'
    : /fban|fbav/i.test(ua) ? ' (navegador do Facebook)'
    : '';
  return so + app;
}

function header(req, nome) {
  const v = req.headers[nome];
  if (!v) return '';
  try { return decodeURIComponent(v); } catch (e) { return v; }
}

module.exports = async (req, res) => {
  const topic = process.env.NTFY_TOPIC;
  const ua = req.headers['user-agent'] || '';

  if (req.method !== 'POST' || !topic || BOTS.test(ua)) {
    res.statusCode = 204;
    return res.end();
  }

  let origem = '';
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (typeof body.ref === 'string' && body.ref) origem = new URL(body.ref).hostname;
  } catch (e) { /* corpo inválido: segue sem origem */ }

  const cidade = [header(req, 'x-vercel-ip-city'), header(req, 'x-vercel-ip-country-region')]
    .filter(Boolean).join('/') || 'local desconhecido';
  const hora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

  const linhas = [
    hora,
    'Cidade aproximada: ' + cidade,
    'Aparelho: ' + aparelho(ua),
  ];
  if (origem) linhas.push('Veio de: ' + origem);

  try {
    await fetch('https://ntfy.sh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic,
        title: 'Página da Menezes foi aberta',
        message: linhas.join('\n'),
        tags: ['eyes'],
        priority: 4,
      }),
    });
  } catch (e) { /* ntfy fora do ar não pode quebrar nada pro visitante */ }

  res.statusCode = 204;
  res.end();
};
