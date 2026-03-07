import { Navigate } from 'react-router';

export const RedirectToLogin = () => <Navigate to="/login" replace />;

export const AdminUsersPlaceholder = () => (
  <div className="flex items-center justify-center py-20">
    <div className="text-center">
      <div className="text-6xl mb-4">🚧</div>
      <h2 className="text-2xl font-bold mb-2">Coming Soon</h2>
      <p className="text-muted-foreground">This page is under development</p>
    </div>
  </div>
);

export const NotFound = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="text-center">
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <p className="text-muted-foreground">Page not found</p>
    </div>
  </div>
);