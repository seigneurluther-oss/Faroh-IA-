function handleAiChat(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      code: 'METHOD_NOT_ALLOWED',
      message: 'Method not allowed',
    }));
    return;
  }

  let body = '';

  req.on('data', (chunk) => {
    body += chunk;
  });

  req.on('end', () => {
    try {
      const data = JSON.parse(body);

      if (!data.question || !data.language) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          code: 'INVALID_REQUEST',
          message: 'Question and language are required.',
        }));
        return;
      }

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        message: 'Faroh IA pare pou konekte ak yon founisè IA.',
        provider: 'none',
        configured: false,
      }));
    } catch {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        code: 'INVALID_JSON',
        message: 'Invalid request.',
      }));
    }
  });
}

module.exports = { handleAiChat };