import { Route, Routes } from 'react-router-dom';
import { CatalogPage } from '../pages/CatalogPage';
import { CoursePage } from '../pages/CoursePage';
import { HomePage } from '../pages/HomePage';
import { IntroLessonPage } from '../pages/IntroLessonPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { PlaceholderPage } from '../pages/PlaceholderPage';
import { Layout } from './Layout';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="courses" element={<CatalogPage />} />
        <Route path="courses/:id" element={<CoursePage />} />
        <Route path="courses/:id/intro" element={<IntroLessonPage />} />
        <Route path="login" element={<PlaceholderPage title="Вхід" />} />
        <Route path="register" element={<PlaceholderPage title="Реєстрація" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

