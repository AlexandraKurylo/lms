import { expect, test, type APIRequestContext } from '@playwright/test';

const DEMO_PASSWORD = 'Demo12345!';
const STUDENT_PASSWORD = 'Student12345';
const DAY_MS = 86_400_000;

function isoDate(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

async function signIn(request: APIRequestContext, email: string): Promise<void> {
  const response = await request.post('/api/auth/login', {
    data: { email, password: DEMO_PASSWORD },
  });
  expect(response.ok()).toBeTruthy();
}

async function createRunningCourse(
  teacher: APIRequestContext,
  admin: APIRequestContext,
  title: string,
): Promise<number> {
  const course = await teacher.post('/api/teacher/courses', {
    data: {
      title,
      description: 'Наскрізний сценарій: запис на потік і проходження уроків',
      sequentialLessons: true,
    },
  });
  expect(course.status()).toBe(201);
  const { id } = (await course.json()) as { id: number };

  for (const lessonTitle of ['Перший урок', 'Другий урок']) {
    const lesson = await teacher.post(`/api/teacher/courses/${id}/lessons`, {
      data: { title: lessonTitle, content: `Зміст уроку «${lessonTitle}»` },
    });
    expect(lesson.status()).toBe(201);
  }

  const stream = await teacher.post(`/api/teacher/courses/${id}/streams`, {
    data: { title: 'Потік E2E', startsOn: isoDate(-1), endsOn: isoDate(30), capacity: 1 },
  });
  expect(stream.status()).toBe(201);

  const published = await admin.patch(`/api/admin/courses/${id}/status`, {
    data: { status: 'published' },
  });
  expect(published.ok()).toBeTruthy();
  return id;
}

test('студент проходить шлях від реєстрації до завершення курсу', async ({
  page,
  browser,
  playwright,
  baseURL,
}) => {
  const stamp = Date.now();
  const title = `E2E основи тестування ${stamp}`;
  const email = `e2e.student.${stamp}@example.com`;

  const teacher = await playwright.request.newContext({ baseURL });
  const admin = await playwright.request.newContext({ baseURL });
  await signIn(teacher, 'teacher01@example.com');
  await signIn(admin, 'admin@example.com');
  const courseId = await createRunningCourse(teacher, admin, title);

  await test.step('реєстрація нового студента', async () => {
    await page.goto('/register');
    await page.getByLabel('Ім’я').fill('Е2Е Студент');
    await page.getByLabel('Пошта').fill(email);
    await page.getByLabel('Пароль', { exact: true }).fill(STUDENT_PASSWORD);
    await page.getByLabel('Повторіть пароль').fill(STUDENT_PASSWORD);
    await page.getByRole('button', { name: 'Створити обліковий запис' }).click();
    await expect(page).toHaveURL(/\/courses$/);
  });

  await test.step('пошук курсу в каталозі', async () => {
    await page.getByLabel('Пошук курсів').fill(title);
    await page.getByRole('link', { name: title }).click();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  });

  await test.step('запис на потік', async () => {
    await page.getByRole('button', { name: 'Записатися' }).click();
    await expect(page.getByText('Ви записані')).toBeVisible();
  });

  await test.step('перехід до навчання', async () => {
    await page.getByRole('link', { name: 'Перейти до навчання' }).click();
    await expect(page).toHaveURL(new RegExp(`/learn/${courseId}$`));
    await expect(page.getByText('Пройдено 0 з 2')).toBeVisible();
  });

  await test.step('перший урок позначено пройденим', async () => {
    await page.getByRole('link', { name: 'Почати навчання' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Перший урок' })).toBeVisible();
    await page.getByRole('button', { name: 'Позначити пройденим' }).click();
    await expect(page.getByRole('button', { name: /Зняти позначку/ })).toBeVisible();
  });

  await test.step('другий урок відкрився й позначений пройденим', async () => {
    await page.getByRole('link', { name: /Наступний урок/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Другий урок' })).toBeVisible();
    await page.getByRole('button', { name: 'Позначити пройденим' }).click();
    await expect(page.getByRole('button', { name: /Зняти позначку/ })).toBeVisible();
  });

  await test.step('прогрес курсу дорівнює 100 %', async () => {
    await page.goto(`/learn/${courseId}`);
    await expect(page.getByText('Пройдено 2 з 2')).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'Прогрес курсу' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
  });

  await test.step('другий студент не може записатися: місць немає', async () => {
    const other = await browser.newContext({ baseURL });
    const registered = await other.request.post('/api/auth/register', {
      data: {
        name: 'Е2Е Другий',
        email: `e2e.second.${stamp}@example.com`,
        password: STUDENT_PASSWORD,
      },
    });
    expect(registered.status()).toBe(201);
    const second = await other.newPage();
    await second.goto(`/courses/${courseId}`);
    await expect(second.getByRole('button', { name: 'Місць немає' })).toBeDisabled();
    await other.close();
  });

  await teacher.dispose();
  await admin.dispose();
});
