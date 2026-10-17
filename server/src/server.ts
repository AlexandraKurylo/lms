import { createApp } from './app.js';

const port = Number(process.env.API_PORT ?? 4000);

createApp().listen(port, () => {
  // тимчасовий вивід; на кроці 05 його замінить структурований логер
  // eslint-disable-next-line no-console
  console.log(`API listening on :${port}`);
});
