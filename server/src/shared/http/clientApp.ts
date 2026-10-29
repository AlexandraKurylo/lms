import { join, resolve, sep } from 'node:path';
import express from 'express';
import type { Express } from 'express';

export function serveClient(app: Express, dir: string): void {
  const root = resolve(dir);

  app.use(
    express.static(root, {
      index: false,
      setHeaders: (res, path) => {
        if (path.includes(`${sep}assets${sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );

  app.get(/^\/(?!api(?:\/|$)|assets\/).*/, (_req, res, next) => {
    res.sendFile(join(root, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
}
