// Підхоплюємо змінні з кореневого .env, якщо він є (у CI змінні задаються самим CI).
try {
  process.loadEnvFile('../.env');
} catch {
  // файлу немає — це нормально
}

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL ??= 'silent';
process.env.JWT_SECRET ??= 'test-secret-test-secret-test-secret-0000';
process.env.DATABASE_URL ??= 'postgres://lms:lms_dev_password@localhost:5432/lms';
