import { Route, Routes } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AccountPage } from '../pages/AccountPage';
import { CatalogPage } from '../pages/CatalogPage';
import { CoursePage } from '../pages/CoursePage';
import { HomePage } from '../pages/HomePage';
import { IntroLessonPage } from '../pages/IntroLessonPage';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { RegisterPage } from '../pages/RegisterPage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="courses" element={<CatalogPage />} />
        <Route path="courses/:id" element={<CoursePage />} />
        <Route path="courses/:id/intro" element={<IntroLessonPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route
          path="account"
          element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
