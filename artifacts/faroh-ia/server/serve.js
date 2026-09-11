/**
 * Standalone production server for Faroh IA.
 * Serves the Expo static build and the AI API.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleAiChat } = require('../ai-chat');

const STATIC_ROOT = path.resolve(__dirname, '..', 'static-build');
const TEMPLATE_PATH = path.resolve(__dirname, 'templates', 'landing-page.html');
const basePath = (process.env.BASE_PATH || '').replace(/\/+$/, '');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json',
};

function getAppName() {
  try {
    const appJsonPath = path.resolve(__dirname, '..', 'app.json');
    const appJson = JSON.parse(
      fs.readFileSync(appJsonPath, 'utf-8')
    );

    return typeof appJson.expo?.name === 'string'
      ? appJson.expo.name
      : 'Faroh IA';
  } catch {
    return 'Faroh IA';
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toScriptString(value) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
  });

  res.end(JSON.stringify(data));
}

function serveManifest(platform, res) {
  const manifestPath = path.join(
    STATIC_ROOT,
    platform,
    'manifest.json'
  );

  if (!fs.existsSync(manifestPath)) {
    sendJson(res, 404, {
      error: `Manifest not found for platform: ${platform}`,
    });
    return;
  }

  const manifest = fs.readFileSync(
    manifestPath,
    'utf-8'
  );

  res.writeHead(200, {
    'content-type': 'application/json',
    'expo-protocol-version': '1',
    'expo-sfv-version': '0',
  });

  res.end(manifest);
}

function serveLandingPage(
  req,
  res,
  landingPageTemplate,
  appName
) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = forwardedProto || 'https';

  const host =
    req.headers['x-forwarded-host'] ||
    req.headers['host'] ||
    'localhost';

  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `exps://${host}${basePath}/`;

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(
      /EXPS_URL_ATTRIBUTE_PLACEHOLDER/g,
      escapeHtml(expsUrl)
    )
    .replace(
      /EXPS_URL_JSON_PLACEHOLDER/g,
      toScriptString(expsUrl)
    )
    .replace(
      /APP_NAME_PLACEHOLDER/g,
      escapeHtml(appName)
    );

  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
  });

  res.end(html);
}

function serveStaticFile(urlPath, res) {
  const decodedPath = decodeURIComponent(urlPath);

  const safePath = path
    .normalize(decodedPath)
    .replace(/^(\.\.(\/|\\|$))+/, '');

  const filePath = path.join(
    STATIC_ROOT,
    safePath
  );

  if (!filePath.startsWith(STATIC_ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (
    !fs.existsSync(filePath) ||
    fs.statSync(filePath).isDirectory()
  ) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  const ext = path
    .extname(filePath)
    .toLowerCase();

  const contentType =
    MIME_TYPES[ext] ||
    'application/octet-stream';

  const content = fs.readFileSync(filePath);

  res.writeHead(200, {
    'content-type': contentType,
  });

  res.end(content);
}

let landingPageTemplate = '';

try {
  landingPageTemplate = fs.readFileSync(
    TEMPLATE_PATH,
    'utf-8'
  );
} catch (error) {
  console.error(
    'Could not load landing page template:',
    error
  );

  landingPageTemplate =
    '<!doctype html><html><body><h1>Faroh IA</h1></body></html>';
}

const appName = getAppName();

const server = http.createServer(
  async (req, res) => {
    try {
      const url = new URL(
        req.url || '/',
        `http://${req.headers.host || 'localhost'}`
      );

      let pathname = url.pathname;

      if (
        basePath &&
        pathname.startsWith(basePath)
      ) {
        pathname =
          pathname.slice(basePath.length) || '/';
      }

      // ==============================
      // HEALTH CHECK
      // ==============================

      if (
        pathname === '/api' ||
        pathname === '/api/healthz'
      ) {
        sendJson(res, 200, {
          ok: true,
          service: 'faroh-ia',
        });

        return;
      }

      // ==============================
      // AI CHAT
      // ==============================

      if (pathname === '/api/ai/chat') {
        if (req.method !== 'POST') {
          sendJson(res, 405, {
            error: 'Method not allowed',
          });

          return;
        }

        let body = '';

        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            const data = JSON.parse(
              body || '{}'
            );

            if (
              typeof data.question !== 'string' ||
              !data.question.trim()
            ) {
              sendJson(res, 400, {
                error: 'Question is required',
              });

              return;
            }

            const result =
              await handleAiChat({
                question: data.question,
                language: data.language,
                imageData: data.imageData,
              });

            sendJson(res, 200, result);
          } catch (error) {
            console.error(
              'AI chat error:',
              error
            );

            sendJson(res, 500, {
              error: 'AI chat failed',
              message:
                error instanceof Error
                  ? error.message
                  : 'Unknown error',
            });
          }
        });

        return;
      }

      // ==============================
      // EXPO MANIFEST
      // ==============================

      const platform =
        req.headers['expo-platform'];

      const isSupportedPlatform =
        platform === 'ios' ||
        platform === 'android';

      if (
        (pathname === '/' ||
          pathname === '/manifest') &&
        isSupportedPlatform
      ) {
        serveManifest(platform, res);
        return;
      }

      // ==============================
      // LANDING PAGE
      // ==============================

      if (pathname === '/') {
        serveLandingPage(
          req,
          res,
          landingPageTemplate,
          appName
        );

        return;
      }

      // ==============================
      // STATIC EXPO FILES
      // ==============================

      serveStaticFile(
        pathname,
        res
      );
    } catch (error) {
      console.error(
        'Server error:',
        error
      );

      if (!res.headersSent) {
        sendJson(res, 500, {
          error: 'Internal server error',
        });
      } else {
        res.end();
      }
    }
  }
);

// Replit supplies PORT during production deployment.
const port = parseInt(
  process.env.PORT || '3000',
  10
);

server.listen(
  port,
  '0.0.0.0',
  () => {
    console.log(
      `Faroh IA production server listening on port ${port}`
    );
  }
);