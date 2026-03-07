import { RouterProvider } from 'react-router';
import { AuthProvider } from './AuthContext';
import { DataProvider } from './DataContext';
import { router } from './routes';
import { Toaster } from './components/ui/sonner';

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <RouterProvider router={router} />
        <Toaster />
      </DataProvider>
    </AuthProvider>
  );
}