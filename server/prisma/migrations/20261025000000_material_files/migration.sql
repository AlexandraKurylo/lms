-- Файли матеріалів, завантажені викладачем. Для посилань обидва поля порожні.
ALTER TABLE materials
  ADD COLUMN file_name text,
  ADD COLUMN file_path text,
  ADD CONSTRAINT materials_file_pair CHECK ((file_name IS NULL) = (file_path IS NULL));
