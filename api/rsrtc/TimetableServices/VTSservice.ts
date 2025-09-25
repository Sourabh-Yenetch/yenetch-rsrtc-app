import type { VercelRequest, VercelResponse } from '@vercel/node';

// ✅ Disable body parsing so we can handle raw XML SOAP requests
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // ✅ Collect raw XML body
    const chunks: Uint8Array[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks).toString('utf-8');

    // ✅ Forward the SOAP request to RSRTC server
    const response = await fetch(
      'http://mis.rajasthanroadways.com:8081/TimetableServices/VtsService',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': '"getAvailableServices"',
        },
        body,
      }
    );

    if (!response.ok) {
      throw new Error(`RSRTC server error: ${response.status}`);
    }

    const xmlText = await response.text();

    // ✅ Respond with XML
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send(xmlText);
  } catch (error) {
    console.error('RSRTC API Error:', error);
    res.status(500).json({
      error: 'Failed to fetch RSRTC services',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
