import type { INestApplication } from '@nestjs/common';
import type { Express, Response } from 'express';
import { getAbsoluteFSPath } from 'swagger-ui-dist';

// The API itself allows no scripts at all, so these pages need their own policy. Everything is
// served from here, so nothing outside the application is ever asked for.
const DOCS_POLICY =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'";

const PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>CMS API</title>
    <link rel="stylesheet" href="/docs/swagger-ui.css" />
  </head>
  <body>
    <div id="docs"></div>
    <script src="/docs/swagger-ui-bundle.js"></script>
    <script src="/docs/init.js"></script>
  </body>
</html>
`;

const INIT = "window.ui = SwaggerUIBundle({ url: '/openapi.json', dom_id: '#docs' });\n";

function send(response: Response, contentType: string, body: string): void {
  response.setHeader('Content-Security-Policy', DOCS_POLICY);
  response.type(contentType).send(body);
}

function sendAsset(response: Response, name: string): void {
  response.setHeader('Content-Security-Policy', DOCS_POLICY);
  response.sendFile(name, { root: getAbsoluteFSPath() });
}

// FR-PUBAPI-07. Call after configureApp, so these sit behind the same request handling.
export function mountApiDocs(app: INestApplication, document: object): void {
  const server = app.getHttpAdapter().getInstance() as Express;
  server.get('/openapi.json', (_request, response) => {
    response.json(document);
  });
  server.get('/docs', (_request, response) => {
    send(response, 'html', PAGE);
  });
  server.get('/docs/init.js', (_request, response) => {
    send(response, 'js', INIT);
  });
  server.get('/docs/swagger-ui.css', (_request, response) => {
    sendAsset(response, 'swagger-ui.css');
  });
  server.get('/docs/swagger-ui-bundle.js', (_request, response) => {
    sendAsset(response, 'swagger-ui-bundle.js');
  });
}
