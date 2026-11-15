// Google-Bewertungen der Schmidtke GmbH für die Anzeige in der Fußzeile (Zahl der Sterne und Anzahl der Bewertungen).
// Aufruf: /.netlify/functions/bewertungen  →  {"wert": 5, "anzahl": 47, "stand": "2026-11-15"}
//
// Woher die Zahlen kommen: DataForSEO fragt das öffentliche Google-Unternehmensprofil ab (kein Google-Konto, kein Widget).
// Damit das läuft, müssen in Netlify zwei Umgebungsvariablen stehen (Site settings → Environment variables):
//   DATAFORSEO_LOGIN     die E-Mail des DataForSEO-Zugangs
//   DATAFORSEO_PASSWORD  das API-Passwort aus dem DataForSEO-Konto (nicht das Login-Passwort)
// Fehlen sie, antwortet die Funktion mit 503 und die Seite zeigt weiter den festen Stand aus dem Quelltext.
//
// Kosten: Netlify hält die Antwort zwölf Stunden im Zwischenspeicher, DataForSEO wird also höchstens zweimal am Tag gefragt
// (je Abfrage unter einem Cent).

const CID = '7645687569388259363'; // Kennung des Google-Unternehmensprofils „Schmidtke GmbH - YouTube Agentur“, Rottweil
const ADRESSE = 'https://api.dataforseo.com/v3/business_data/google/my_business_info/live';

const antwort = (status, daten, cache) => new Response(JSON.stringify(daten), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cache ? 'public, max-age=3600' : 'no-store',
    ...(cache ? { 'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=43200, stale-while-revalidate=604800' } : {}),
  },
});

export default async () => {
  const login = process.env.DATAFORSEO_LOGIN;
  const passwort = process.env.DATAFORSEO_PASSWORD;
  if (!login || !passwort) return antwort(503, { fehler: 'Zugang zu DataForSEO ist in Netlify nicht hinterlegt' }, false);
  try {
    const r = await fetch(ADRESSE, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${login}:${passwort}`).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ keyword: `cid:${CID}`, location_name: 'Germany', language_code: 'de' }]),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return antwort(502, { fehler: `DataForSEO antwortet mit ${r.status}` }, false);
    const daten = await r.json();
    const eintrag = daten?.tasks?.[0]?.result?.[0]?.items?.[0];
    const wert = Number(eintrag?.rating?.value);
    const anzahl = Number(eintrag?.rating?.votes_count);
    // nur glaubwürdige Zahlen weitergeben, sonst bleibt auf der Seite der feste Stand stehen
    if (!(wert >= 1 && wert <= 5) || !(anzahl >= 1)) return antwort(502, { fehler: 'keine Bewertung in der Antwort' }, false);
    return antwort(200, { wert, anzahl, stand: new Date().toISOString().slice(0, 10) }, true);
  } catch (e) {
    return antwort(502, { fehler: 'Abfrage gescheitert' }, false);
  }
};
