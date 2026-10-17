// Розширюємо тип Request власними полями.
import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    /** Наскрізний ідентифікатор запиту (також повертається в заголовку X-Request-Id). */
    id: string;
  }
}
