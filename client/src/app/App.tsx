import { Route, Routes } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { PlaceholderPage } from '../pages/PlaceholderPage';
import { Layout } from './Layout';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="courses" element={<PlaceholderPage title="Каталог курсів" />} />
        <Route path="login" element={<PlaceholderPage title="Вхід" />} />
        <Route path="register" element={<PlaceholderPage title="Реєстрація" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
