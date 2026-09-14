// Vercel Serverless Function: /api/payload
// Enables cross-device QR code scanning & retrieval (phone, tablet, desktop)

const payloadStore = new Map<string, { payload: string; filename?: string; timestamp: number }>();

export default async function handler(req: any, res: any) {
  // Global CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // keep as is
      }
    }
    const { id, payload, filename } = body || {};
    if (!id || !payload) {
      return res.status(400).json({ error: 'Missing id or payload' });
    }
    const cleanId = String(id).toLowerCase();
    payloadStore.set(cleanId, {
      payload,
      filename,
      timestamp: Date.now(),
    });
    // Evict oldest entries if capacity exceeds 1,000
    if (payloadStore.size > 1000) {
      const oldestKey = payloadStore.keys().next().value;
      if (oldestKey) payloadStore.delete(oldestKey);
    }
    return res.status(200).json({ success: true, id: cleanId });
  }

  if (req.method === 'GET') {
    const id = (req.query?.id || '').toLowerCase();
    if (!id) {
      return res.status(400).json({ error: 'Missing id parameter' });
    }
    const item = payloadStore.get(id);
    if (!item) {
      return res.status(404).json({ error: 'Payload not found or expired' });
    }
    return res.status(200).json({ success: true, id, payload: item.payload, filename: item.filename });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
