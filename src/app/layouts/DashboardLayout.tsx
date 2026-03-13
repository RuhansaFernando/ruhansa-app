import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { LayoutDashboard, FileText, Calendar, Users, Settings, LogOut, Menu, X, Activity, Bell, UserCog, User, ClipboardList, Target, Shield, Briefcase, Heart, ChevronDown, ChevronRight, BookUser, Building2, ClipboardCheck, GraduationCap } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate, useLocation, Link, Outlet } from 'react-router';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userManagementOpen, setUserManagementOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  // Define navigation items based on role
  const getNavigationItems = () => {
    const baseItems = [
      { label: 'Dashboard', icon: LayoutDashboard, path: `/${user.role}/dashboard` },
    ];

    if (user.role === 'advisor') {
      return [
        ...baseItems,
        { label: 'Attendance', icon: ClipboardList, path: '/advisor/attendance' },
        { label: 'Performance', icon: Activity, path: '/advisor/performance' },
        { label: 'Interventions', icon: Target, path: '/advisor/interventions' },
        { label: 'Reports', icon: FileText, path: '/advisor/reports' },
        { label: 'Appointments', icon: Calendar, path: '/advisor/appointments' },
        { label: 'Profile', icon: User, path: '/advisor/settings' },
      ];
    } else if (user.role === 'student') {
      return [
        ...baseItems,
        { label: 'My Appointments', icon: Calendar, path: '/student/appointments' },
        { label: 'Profile', icon: User, path: '/student/settings' },
      ];
    } else if (user.role === 'faculty') {
      return [
        ...baseItems,
        { label: 'My Students', icon: Users, path: '/faculty/students' },
        { label: 'Alerts', icon: Bell, path: '/faculty/alerts' },
        { label: 'Profile', icon: User, path: '/faculty/settings' },
      ];
    } else if (user.role === 'counselor') {
      return [
        ...baseItems,
        { label: 'My Cases', icon: Users, path: '/counselor/cases' },
        { label: 'Analytics', icon: Activity, path: '/counselor/analytics' },
        { label: 'Profile', icon: User, path: '/counselor/settings' },
      ];
    } else if (user.role === 'admin') {
      return [
        ...baseItems,
        { label: 'Students', icon: Users, path: '/admin/students' },
        { label: 'Manage Tutors', icon: BookUser, path: '/admin/tutors' },
        { label: 'SRU Management', icon: ClipboardCheck, path: '/admin/sru' },
        { label: 'Registry Management', icon: Building2, path: '/admin/registry' },
        { label: 'Users', icon: UserCog, path: '/admin/users' },
        { label: 'Profile', icon: User, path: '/admin/settings' },
      ];
    } else if (user.role === 'registry') {
      return [
        ...baseItems,
        { label: 'Modules', icon: GraduationCap, path: '/registry/modules' },
        { label: 'Academic Records', icon: FileText, path: '/registry/grades' },
        { label: 'Reports', icon: ClipboardList, path: '/registry/reports' },
      ];
    } else if (user.role === 'sru') {
      return [
        ...baseItems,
        { label: 'Students', icon: Users, path: '/sru/students' },
        { label: 'Attendance', icon: ClipboardList, path: '/sru/attendance' },
        { label: 'Interventions', icon: Target, path: '/sru/interventions' },
        { label: 'Alerts', icon: Bell, path: '/sru/alerts' },
        { label: 'Reports', icon: FileText, path: '/sru/reports' },
      ];
    }

    return baseItems;
  };

  const navigationItems = getNavigationItems();

  const getRoleName = () => {
    switch (user.role) {
      case 'advisor':
        return 'Academic Advisor';
      case 'faculty':
        return 'Faculty Member';
      case 'counselor':
        return 'Counselor';
      case 'admin':
        return 'Admin';
      case 'student':
        return 'Student';
      case 'sru':
        return 'SRU Staff';
      case 'registry':
        return 'Registry Staff';
      default:
        return user.role;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar for Desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-white border-r">
        {/* Logo Section */}
        <div className="flex items-center justify-between p-2 border-b bg-white">
          <Link to={`/${user.role}/dashboard`}>
            <img src="/src/assets/DropGuard_Logo_Final.png" alt="DropGuard" style={{ width: '140px', height: 'auto', padding: '8px' }} />
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto p-3">
          <div className="space-y-1">
            {navigationItems.map((item) => {
              const isActive = location.pathname.split('?')[0] === item.path.split('?')[0];
              const isUserManagementSection = location.pathname.includes('/admin/users');
              
              if (item.subItems) {
                return (
                  <div key={item.path}>
                    <Button
                      variant="ghost"
                      className={`w-full justify-between gap-3 ${
                        isUserManagementSection
                          ? 'bg-blue-50 text-blue-600 hover:bg-blue-50 hover:text-blue-600'
                          : 'hover:bg-gray-100'
                      }`}
                      onClick={() => setUserManagementOpen(!userManagementOpen)}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </div>
                      {userManagementOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    {userManagementOpen && (
                      <div className="ml-4 mt-1 space-y-1">
                        {item.subItems.map((subItem) => {
                          const subIsActive = location.search.includes(subItem.path.split('?')[1] || '');
                          return (
                            <Link key={subItem.path} to={subItem.path}>
                              <Button
                                variant="ghost"
                                className={`w-full justify-start gap-3 text-sm ${
                                  subIsActive
                                    ? 'bg-blue-50 text-blue-600 hover:bg-blue-50 hover:text-blue-600'
                                    : 'hover:bg-gray-100'
                                }`}
                              >
                                <subItem.icon className="h-4 w-4" />
                                <span>{subItem.label}</span>
                              </Button>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }
              
              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant="ghost"
                    className={`w-full justify-start gap-3 ${
                      isActive
                        ? 'bg-blue-50 text-blue-600 hover:bg-blue-50 hover:text-blue-600'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User Section at Bottom */}
        <div className="border-t p-3 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar className="h-10 w-10 bg-blue-600">
              <AvatarFallback className="bg-blue-600 text-white font-semibold">
                {user.name.split(' ').map((n) => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{getRoleName()}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-red-600 hover:text-red-600 hover:bg-red-50"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
            <span>Logout</span>
          </Button>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setSidebarOpen(false)}>
          <aside
            className="fixed left-0 top-0 bottom-0 w-64 bg-white flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Logo Section */}
            <div className="flex items-center justify-between p-2 border-b bg-white">
              <Link to={`/${user.role}/dashboard`}>
                <img src="/src/assets/DropGuard_Logo_Final.png" alt="DropGuard" style={{ width: '140px', height: 'auto', padding: '8px' }} />
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 overflow-y-auto p-3">
              <div className="space-y-1">
                {navigationItems.map((item) => {
                  const isActive = location.pathname.split('?')[0] === item.path.split('?')[0];
                  const isUserManagementSection = location.pathname.includes('/admin/users');
                  
                  if (item.subItems) {
                    return (
                      <div key={item.path}>
                        <Button
                          variant="ghost"
                          className={`w-full justify-between gap-3 ${
                            isUserManagementSection
                              ? 'bg-blue-50 text-blue-600 hover:bg-blue-50 hover:text-blue-600'
                              : 'hover:bg-gray-100'
                          }`}
                          onClick={() => setUserManagementOpen(!userManagementOpen)}
                        >
                          <div className="flex items-center gap-3">
                            <item.icon className="h-5 w-5" />
                            <span>{item.label}</span>
                          </div>
                          {userManagementOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                        {userManagementOpen && (
                          <div className="ml-4 mt-1 space-y-1">
                            {item.subItems.map((subItem) => {
                              const subIsActive = location.search.includes(subItem.path.split('?')[1] || '');
                              return (
                                <Link key={subItem.path} to={subItem.path} onClick={() => setSidebarOpen(false)}>
                                  <Button
                                    variant="ghost"
                                    className={`w-full justify-start gap-3 text-sm ${
                                      subIsActive
                                        ? 'bg-blue-50 text-blue-600 hover:bg-blue-50 hover:text-blue-600'
                                        : 'hover:bg-gray-100'
                                    }`}
                                  >
                                    <subItem.icon className="h-4 w-4" />
                                    <span>{subItem.label}</span>
                                  </Button>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }
                  
                  return (
                    <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}>
                      <Button
                        variant="ghost"
                        className={`w-full justify-start gap-3 ${
                          isActive
                            ? 'bg-blue-50 text-blue-600 hover:bg-blue-50 hover:text-blue-600'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        <item.icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </nav>

            {/* User Section at Bottom */}
            <div className="border-t p-3 space-y-2">
              <div className="flex items-center gap-3 px-3 py-2">
                <Avatar className="h-10 w-10 bg-blue-600">
                  <AvatarFallback className="bg-blue-600 text-white font-semibold">
                    {user.name.split(' ').map((n) => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{getRoleName()}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-red-600 hover:text-red-600 hover:bg-red-50"
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5" />
                <span>Logout</span>
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center">
            <img src="/src/assets/DropGuard_Logo_Final.png" alt="DropGuard" style={{ width: '100px', height: 'auto' }} />
          </div>
          <div className="w-10" /> {/* Spacer for alignment */}
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}