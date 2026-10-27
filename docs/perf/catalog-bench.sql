-- Бенчмарк каталогу курсів.
--   1) docker compose exec db psql -U lms -d lms -c "CREATE DATABASE lms_bench"
--   2) cd server && DATABASE_URL="postgres://lms:lms_dev_password@localhost:5432/lms_bench" npx prisma migrate deploy
--   3) docker compose exec -T db psql -X -U lms -d lms_bench < docs/perf/catalog-bench.sql

\set ON_ERROR_STOP on
\pset pager off

TRUNCATE users, topics, courses RESTART IDENTITY CASCADE;

INSERT INTO users (email, password_hash, name, role)
VALUES ('bench@example.com', 'x', 'Bench Teacher', 'teacher');

INSERT INTO topics (name) SELECT 'Тема ' || g FROM generate_series(1, 20) g;

INSERT INTO courses (title, description, teacher_id, status)
SELECT 'Курс ' || md5(g::text),
       'Опис ' || md5((g * 7)::text) || ' ' || md5((g * 13)::text),
       1,
       CASE WHEN g % 10 = 0 THEN 'draft'::course_status ELSE 'published'::course_status END
FROM generate_series(1, 200000) g;

INSERT INTO course_topics (course_id, topic_id)
SELECT c, 1 + (c % 20) FROM generate_series(1, 200000) c
UNION
SELECT c, 1 + ((c * 7 + 3) % 20) FROM generate_series(1, 200000) c;

VACUUM (ANALYZE) courses;
VACUUM (ANALYZE) course_topics;

SELECT (SELECT count(*) FROM courses) AS courses,
       (SELECT count(*) FROM courses WHERE status = 'published') AS published,
       (SELECT count(*) FROM course_topics) AS course_topics;

\echo
\echo === 1. Перша сторінка каталогу, з індексом courses_catalog_idx ===
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT id, title FROM courses WHERE status = 'published' ORDER BY title, id LIMIT 21;

\echo
\echo === 1. Те саме без індексу ===
BEGIN;
DROP INDEX courses_catalog_idx;
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT id, title FROM courses WHERE status = 'published' ORDER BY title, id LIMIT 21;
ROLLBACK;

SELECT title AS cursor_title, id AS cursor_id
FROM courses WHERE status = 'published' ORDER BY title, id OFFSET 100000 LIMIT 1 \gset

\echo
\echo === 2. Глибока сторінка: курсор у вигляді OR, як зараз формує Prisma ===
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT id, title FROM courses
WHERE status = 'published'
  AND (title > :'cursor_title' OR (title = :'cursor_title' AND id > :cursor_id))
ORDER BY title, id LIMIT 21;

\echo
\echo === 2. Глибока сторінка: курсор через порівняння рядків (title, id) > (...) ===
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT id, title FROM courses
WHERE status = 'published' AND (title, id) > (:'cursor_title', :cursor_id)
ORDER BY title, id LIMIT 21;

\echo
\echo === 2. Глибока сторінка: OFFSET 100000 ===
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT id, title FROM courses WHERE status = 'published' ORDER BY title, id OFFSET 100000 LIMIT 21;

\echo
\echo === 3. Фільтр за темою, з індексом course_topics_topic_idx ===
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT c.id, c.title FROM courses c
WHERE c.status = 'published'
  AND EXISTS (SELECT 1 FROM course_topics ct WHERE ct.course_id = c.id AND ct.topic_id = 7)
ORDER BY c.title, c.id LIMIT 21;

\echo
\echo === 3. Те саме без індексів courses_catalog_idx і course_topics_topic_idx ===
BEGIN;
DROP INDEX courses_catalog_idx;
DROP INDEX course_topics_topic_idx;
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT c.id, c.title FROM courses c
WHERE c.status = 'published'
  AND EXISTS (SELECT 1 FROM course_topics ct WHERE ct.course_id = c.id AND ct.topic_id = 7)
ORDER BY c.title, c.id LIMIT 21;
ROLLBACK;

\echo
\echo === 4. Пошук за підрядком (ILIKE), індексу немає ===
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT id, title FROM courses
WHERE status = 'published' AND (title ILIKE '%abc123%' OR description ILIKE '%abc123%')
ORDER BY title, id LIMIT 21;
