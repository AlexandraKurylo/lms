// Довідкові дані для сидів: теми, курси, імена, фрази для уроків.

export const TOPICS = [
  'Програмування',
  'Веб-розробка',
  'Бази даних',
  'Data Science',
  'Дизайн',
  'Мобільна розробка',
  'DevOps',
  'Кібербезпека',
  'Алгоритми',
  'Мережі',
  'Штучний інтелект',
  'Менеджмент проєктів',
] as const;

export type Level = 'beginner' | 'intermediate' | 'advanced';

export interface CourseSeed {
  title: string;
  topics: string[];
  level: Level;
  language: 'uk' | 'en' | 'pl';
  /** Чернетка: адміністратор її ще не опублікував. */
  draft?: boolean;
}

export const COURSES: CourseSeed[] = [
  {
    title: 'JavaScript з нуля',
    topics: ['Програмування', 'Веб-розробка'],
    level: 'beginner',
    language: 'uk',
  },
  {
    title: 'TypeScript для впевненого коду',
    topics: ['Програмування', 'Веб-розробка'],
    level: 'intermediate',
    language: 'uk',
  },
  {
    title: 'React: компоненти та стан',
    topics: ['Веб-розробка'],
    level: 'intermediate',
    language: 'uk',
  },
  {
    title: 'Node.js та Express',
    topics: ['Веб-розробка', 'Програмування'],
    level: 'intermediate',
    language: 'uk',
  },
  {
    title: 'HTML і CSS: адаптивна верстка',
    topics: ['Веб-розробка', 'Дизайн'],
    level: 'beginner',
    language: 'uk',
  },
  {
    title: 'PostgreSQL: від запитів до індексів',
    topics: ['Бази даних'],
    level: 'intermediate',
    language: 'uk',
  },
  {
    title: 'SQL для аналітиків',
    topics: ['Бази даних', 'Data Science'],
    level: 'beginner',
    language: 'uk',
  },
  { title: 'Python для початківців', topics: ['Програмування'], level: 'beginner', language: 'uk' },
  {
    title: 'Python для аналізу даних',
    topics: ['Data Science', 'Програмування'],
    level: 'intermediate',
    language: 'uk',
  },
  {
    title: 'Machine Learning: перші моделі',
    topics: ['Штучний інтелект', 'Data Science'],
    level: 'intermediate',
    language: 'en',
  },
  {
    title: 'Deep Learning на практиці',
    topics: ['Штучний інтелект'],
    level: 'advanced',
    language: 'en',
  },
  {
    title: 'Git та командна робота',
    topics: ['Програмування', 'DevOps'],
    level: 'beginner',
    language: 'uk',
  },
  { title: 'Docker для розробників', topics: ['DevOps'], level: 'intermediate', language: 'uk' },
  {
    title: 'Kubernetes: основи оркестрації',
    topics: ['DevOps'],
    level: 'advanced',
    language: 'en',
  },
  { title: 'CI/CD на GitHub Actions', topics: ['DevOps'], level: 'intermediate', language: 'uk' },
  { title: 'Основи кібербезпеки', topics: ['Кібербезпека'], level: 'beginner', language: 'uk' },
  {
    title: 'Безпека вебзастосунків (OWASP)',
    topics: ['Кібербезпека', 'Веб-розробка'],
    level: 'advanced',
    language: 'uk',
  },
  {
    title: 'Алгоритми і структури даних',
    topics: ['Алгоритми', 'Програмування'],
    level: 'intermediate',
    language: 'uk',
  },
  { title: 'Динамічне програмування', topics: ['Алгоритми'], level: 'advanced', language: 'en' },
  { title: "Комп'ютерні мережі", topics: ['Мережі'], level: 'beginner', language: 'uk' },
  { title: 'Основи UX/UI дизайну', topics: ['Дизайн'], level: 'beginner', language: 'uk' },
  { title: 'Figma для інтерфейсів', topics: ['Дизайн'], level: 'beginner', language: 'uk' },
  {
    title: 'Дизайн-системи',
    topics: ['Дизайн', 'Веб-розробка'],
    level: 'advanced',
    language: 'en',
  },
  {
    title: 'Android на Kotlin',
    topics: ['Мобільна розробка'],
    level: 'intermediate',
    language: 'uk',
  },
  { title: 'iOS на Swift', topics: ['Мобільна розробка'], level: 'intermediate', language: 'en' },
  {
    title: 'React Native',
    topics: ['Мобільна розробка', 'Веб-розробка'],
    level: 'intermediate',
    language: 'uk',
  },
  {
    title: 'Scrum та Kanban на практиці',
    topics: ['Менеджмент проєктів'],
    level: 'beginner',
    language: 'uk',
  },
  {
    title: 'Управління ІТ-проєктами',
    topics: ['Менеджмент проєктів'],
    level: 'intermediate',
    language: 'uk',
  },
  { title: 'MongoDB для розробників', topics: ['Бази даних'], level: 'beginner', language: 'uk' },
  {
    title: 'Проєктування REST API',
    topics: ['Веб-розробка', 'Програмування'],
    level: 'intermediate',
    language: 'uk',
  },
  {
    title: 'GraphQL на практиці',
    topics: ['Веб-розробка'],
    level: 'advanced',
    language: 'en',
    draft: true,
  },
  {
    title: 'Тестування програмного забезпечення',
    topics: ['Програмування'],
    level: 'beginner',
    language: 'uk',
  },
  {
    title: 'Автоматизація тестування',
    topics: ['Програмування', 'DevOps'],
    level: 'intermediate',
    language: 'uk',
  },
  {
    title: 'Linux для адміністраторів',
    topics: ['DevOps', 'Мережі'],
    level: 'beginner',
    language: 'uk',
  },
  {
    title: 'Хмарні технології AWS',
    topics: ['DevOps'],
    level: 'intermediate',
    language: 'en',
    draft: true,
  },
  {
    title: 'Візуалізація даних',
    topics: ['Data Science', 'Дизайн'],
    level: 'intermediate',
    language: 'uk',
  },
  { title: 'Основи нейромереж', topics: ['Штучний інтелект'], level: 'beginner', language: 'uk' },
  {
    title: 'Java: programowanie obiektowe',
    topics: ['Програмування'],
    level: 'intermediate',
    language: 'pl',
  },
  {
    title: 'Rust для системного програмування',
    topics: ['Програмування'],
    level: 'advanced',
    language: 'en',
    draft: true,
  },
  {
    title: 'Підготовка до технічного інтерв’ю',
    topics: ['Алгоритми', 'Менеджмент проєктів'],
    level: 'intermediate',
    language: 'uk',
    draft: true,
  },
];

export const FIRST_NAMES = [
  'Олександр',
  'Марія',
  'Андрій',
  'Олена',
  'Дмитро',
  'Наталія',
  'Іван',
  'Катерина',
  'Максим',
  'Софія',
  'Володимир',
  'Анна',
  'Богдан',
  'Юлія',
  'Тарас',
  'Ірина',
  'Назар',
  'Оксана',
  'Ярослав',
  'Вікторія',
  'Павло',
  'Дарина',
  'Роман',
  'Тетяна',
  'Сергій',
  'Аліна',
  'Олег',
  'Людмила',
  'Євген',
  'Поліна',
];

export const LAST_NAMES = [
  'Коваленко',
  'Шевченко',
  'Бондаренко',
  'Ткаченко',
  'Кравченко',
  'Мельник',
  'Олійник',
  'Шевчук',
  'Поліщук',
  'Савченко',
  'Мороз',
  'Лисенко',
  'Гончаренко',
  'Петренко',
  'Руденко',
  'Клименко',
  'Кузьменко',
  'Павленко',
  'Марченко',
  'Захарченко',
  'Левченко',
  'Іваненко',
  'Яковенко',
  'Грищенко',
  'Дяченко',
  'Сидоренко',
  'Волошин',
  'Мартинюк',
  'Романюк',
  'Яремчук',
];

export const TEACHER_BIOS = [
  'Понад 10 років у розробці, веде курси для початківців і менторить джуніорів.',
  'Працює в продуктовій компанії, любить пояснювати складне простими словами.',
  'Викладач університету та практик: поєднує теорію з реальними проєктами.',
  'Автор технічного блогу, спікер конференцій, консультант зі стартапів.',
];

export const LESSON_PHRASES = [
  'Основні поняття',
  'Перші кроки',
  'Практичне заняття',
  'Типові помилки',
  'Підсумки модуля',
  'Міні-проєкт',
  'Розбір прикладів',
  'Інструменти та середовище',
  'Робота з даними',
  'Тестування рішення',
  'Оптимізація',
  'Добрі практики',
  'Огляд інструментів',
  'Командна робота',
  'Розбір домашнього завдання',
  'Поглиблений розбір',
  'Реальні кейси',
  'Налагодження',
  'Структура проєкту',
  'Фінальний огляд',
];

export const LESSON_SENTENCES = [
  'У цьому уроці ми розбираємо ключові ідеї теми на невеликих прикладах.',
  'Спершу коротко повторимо попередній матеріал, а потім перейдемо до практики.',
  'Приклади можна відтворити самостійно: код і матеріали прикріплено нижче.',
  'Зверніть увагу на типові помилки — вони трапляються найчастіше.',
  'Після перегляду виконайте завдання й порівняйте результат із прикладом.',
  'Складні місця варто перечитати двічі й спробувати змінити приклад під себе.',
  'Наприкінці уроку підсумуємо головні висновки та підготуємося до наступної теми.',
  'Матеріал побудовано від простого до складного, тож не пропускайте кроки.',
];

export const FEEDBACK_PHRASES = [
  'Добра робота, рішення охайне й зрозуміле.',
  'Загалом правильно, але зверніть увагу на крайні випадки.',
  'Є кілька помилок у логіці — перегляньте приклад із уроку.',
  'Чудово! Рекомендую додати більше коментарів до коду.',
  'Рішення працює, проте його можна спростити.',
  'Потрібне доопрацювання: частину вимог не виконано.',
];

export const MATERIAL_TEMPLATES: { kind: 'video' | 'article' | 'file' | 'link'; title: string }[] =
  [
    { kind: 'video', title: 'Відеозапис уроку' },
    { kind: 'article', title: 'Конспект уроку' },
    { kind: 'file', title: 'Архів із прикладами' },
    { kind: 'link', title: 'Корисні посилання' },
  ];
