// Aviso de abertura da página via ntfy.sh (push no celular do Inacio).
// Só funciona com a variável de ambiente NTFY_TOPIC configurada na Vercel; sem ela, não faz nada.
// Não guarda nada e não envia IP: só horário, cidade aproximada (geo da Vercel), país, aparelho e navegador.
//
// Três tipos de aviso, enviados pelo script da página (index.html):
//   abertura: só depois de um sinal humano (toque, rolagem ou tecla), pra verificador automático de links não contar
//   cta:      a pessoa tocou em "Quero este site no ar" (botão da Evolue)
//   resumo:   ao sair da página: tempo, até onde rolou, se chegou na proposta, toques no WhatsApp
// Abertura de fora do Brasil não é descartada: chega marcada como "Suspeito", com prioridade menor.

const NOME = 'Menezes';
const BOTS = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|headless|lighthouse|phantom|curl|wget|python|node-fetch|axios|go-http|java\//i;

function aparelho(ua) {
  const so = /iphone|ipad/i.test(ua) ? 'iPhone/iPad'
    : /android/i.test(ua) ? 'Android'
    : /windows/i.test(ua) ? 'Windows'
    : /mac os/i.test(ua) ? 'Mac'
    : /linux/i.test(ua) ? 'Linux'
    : 'outro';
  const nav = /instagram/i.test(ua) ? 'navegador do Instagram'
    : /fban|fbav/i.test(ua) ? 'navegador do Facebook'
    : /edg\//i.test(ua) ? 'Edge'
    : /samsungbrowser/i.test(ua) ? 'Samsung Internet'
    : /firefox|fxios/i.test(ua) ? 'Firefox'
    : /chrome|crios/i.test(ua) ? 'Chrome'
    : /safari/i.test(ua) ? 'Safari'
    : '';
  return nav ? so + ' · ' + nav : so;
}

function header(req, nome) {
  const v = req.headers[nome];
  if (!v) return '';
  try { return decodeURIComponent(v); } catch (e) { return v; }
}

function tempo(seg) {
  seg = Math.max(0, Math.round(seg));
  if (seg < 60) return seg + ' s';
  return Math.floor(seg / 60) + ' min ' + String(seg % 60).padStart(2, '0') + ' s';
}

const num = (v, max) => { const n = Number(v); return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0; };

module.exports = async (req, res) => {
  const topic = process.env.NTFY_TOPIC;
  const ua = req.headers['user-agent'] || '';
  const site = req.headers['sec-fetch-site'];

  // só aceita chamadas feitas pela própria página (impede que terceiros mandem aviso falso)
  if (req.method !== 'POST' || !topic || BOTS.test(ua) || (site && site !== 'same-origin')) {
    res.statusCode = 204;
    return res.end();
  }

  let corpo = {};
  try { corpo = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch (e) { corpo = {}; }
  const tipo = ['abertura', 'cta', 'resumo'].includes(corpo.t) ? corpo.t : 'abertura';

  const pais = header(req, 'x-vercel-ip-country');
  const foraDoBrasil = !!pais && pais !== 'BR';
  const cidade = [header(req, 'x-vercel-ip-city'), header(req, 'x-vercel-ip-country-region')].filter(Boolean).join('/') || 'local desconhecido';
  const local = foraDoBrasil ? cidade + ' (' + pais + ')' : cidade;
  const hora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

  let origem = '';
  try { if (typeof corpo.ref === 'string' && corpo.ref) origem = new URL(corpo.ref).hostname; } catch (e) { /* sem origem */ }

  let title, linhas, priority, tags;
  if (tipo === 'abertura') {
    title = foraDoBrasil ? 'Suspeito: página da ' + NOME + ' aberta de fora do Brasil' : 'Página da ' + NOME + ' foi aberta';
    linhas = [hora, 'Cidade aproximada: ' + local, 'Aparelho: ' + aparelho(ua), 'Houve toque ou rolagem na página.'];
    if (origem) linhas.push('Veio de: ' + origem);
    if (foraDoBrasil) linhas.push('Fora do Brasil costuma ser verificador automático ou VPN.');
    priority = foraDoBrasil ? 2 : 4;
    tags = [foraDoBrasil ? 'warning' : 'eyes'];
  } else if (tipo === 'cta') {
    title = 'Tocou em "Quero este site no ar" (' + NOME + ')';
    linhas = [hora, 'Cidade aproximada: ' + local, 'Aparelho: ' + aparelho(ua), 'Abriu o WhatsApp da Evolue. Pode chegar mensagem a qualquer momento.'];
    priority = 5;
    tags = ['tada'];
  } else {
    const wa = corpo.wa || {};
    title = 'Resumo da visita à página da ' + NOME;
    linhas = [
      hora,
      'Ficou ' + tempo(num(corpo.seg, 7200)) + ' · rolou ' + Math.round(num(corpo.rolou, 100)) + '% da página',
      'Chegou na proposta da Evolue: ' + (corpo.proposta ? 'sim' : 'não'),
      'Toques no WhatsApp: empresa ' + Math.round(num(wa.empresa, 50)) + ', Evolue ' + Math.round(num(wa.evolue, 50)),
      'Cidade aproximada: ' + local + ' · ' + aparelho(ua),
    ];
    priority = 3;
    tags = ['bar_chart'];
  }

  try {
    await fetch('https://ntfy.sh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, title, message: linhas.join('\n'), tags, priority }),
    });
  } catch (e) { /* ntfy fora do ar não pode quebrar nada pro visitante */ }

  res.statusCode = 204;
  res.end();
};
