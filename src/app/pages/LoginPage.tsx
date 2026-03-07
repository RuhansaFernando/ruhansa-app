import { useState } from 'react';
import { useNavigate } from 'react-router';
import { mockUsers } from '../mockData';
import { useAuth } from '../AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { GraduationCap } from 'lucide-react';
import backgroundImage from 'figma:asset/499fbef49f15d05928a99e1c8b5870312f837196.png';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showDesktop, setShowDesktop] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    // Find user by email and password (role-agnostic login)
    const user = mockUsers.find(
      (u) => u.email === email && u.password === password
    );

    if (user) {
      login(user);
      // Navigate based on role
      switch (user.role) {
        case 'advisor':
          navigate('/advisor/dashboard');
          break;
        case 'student':
          navigate('/student/dashboard');
          break;
        case 'faculty':
          navigate('/faculty/dashboard');
          break;
        case 'counselor':
          navigate('/counselor/dashboard');
          break;
        case 'admin':
          navigate('/admin/dashboard');
          break;
        default:
          navigate('/');
      }
    }
  };

  const handleQuickLogin = (userEmail: string) => {
    const user = mockUsers.find((u) => u.email === userEmail);
    if (user) {
      setEmail(user.email);
      setPassword(user.password);
    }
  };

  if (showDesktop) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="w-full max-w-4xl bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-blue-600 rounded-full">
                <GraduationCap className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">Student Risk Management System</h1>
            <p className="text-muted-foreground mt-2">Demo Accounts - Quick Login</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              variant="outline"
              size="lg"
              className="h-auto flex-col items-start p-4"
              onClick={() => {
                handleQuickLogin('sarah.johnson@university.edu');
                setShowDesktop(false);
              }}
            >
              <span className="font-semibold">Academic Advisor</span>
              <span className="text-xs text-muted-foreground mt-1">sarah.johnson@university.edu</span>
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              className="h-auto flex-col items-start p-4"
              onClick={() => {
                handleQuickLogin('john.smith@student.edu');
                setShowDesktop(false);
              }}
            >
              <span className="font-semibold">Student (High Risk)</span>
              <span className="text-xs text-muted-foreground mt-1">john.smith@student.edu</span>
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              className="h-auto flex-col items-start p-4"
              onClick={() => {
                handleQuickLogin('emily.roberts@university.edu');
                setShowDesktop(false);
              }}
            >
              <span className="font-semibold">Faculty Member</span>
              <span className="text-xs text-muted-foreground mt-1">emily.roberts@university.edu</span>
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              className="h-auto flex-col items-start p-4"
              onClick={() => {
                handleQuickLogin('lisa.anderson@university.edu');
                setShowDesktop(false);
              }}
            >
              <span className="font-semibold">Counselor</span>
              <span className="text-xs text-muted-foreground mt-1">lisa.anderson@university.edu</span>
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              className="h-auto flex-col items-start p-4 md:col-span-2"
              onClick={() => {
                handleQuickLogin('admin@university.edu');
                setShowDesktop(false);
              }}
            >
              <span className="font-semibold">Administrator</span>
              <span className="text-xs text-muted-foreground mt-1">admin@university.edu</span>
            </Button>
          </div>

          <div className="mt-6 text-center">
            <Button
              variant="ghost"
              onClick={() => setShowDesktop(false)}
              className="text-blue-600"
            >
              ← Back to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md">
        <div 
          className="rounded-2xl p-8 shadow-2xl backdrop-blur-xl"
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-blue-600 rounded-lg">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">NOVARA</h1>
              <h2 className="text-xl font-bold text-white">UNIVERSITY</h2>
            </div>
          </div>

          {/* Sign in heading */}
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-white mb-2">Sign in</h2>
            <p className="text-white/80 text-sm">
              Enter your credentials to access your account
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white text-sm font-medium">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="username@novara.ac.lk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/20 border-white/30 text-white placeholder:text-white/60 backdrop-blur-sm focus:bg-white/30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white text-sm font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-white/20 border-white/30 text-white placeholder:text-white/60 backdrop-blur-sm focus:bg-white/30"
              />
            </div>

            {/* Remember me and Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  className="border-white/40 data-[state=checked]:bg-white data-[state=checked]:text-blue-600"
                />
                <label
                  htmlFor="remember"
                  className="text-sm text-white cursor-pointer"
                >
                  Remember me
                </label>
              </div>
              <button
                type="button"
                className="text-sm text-blue-300 hover:text-blue-200 transition-colors"
              >
                Forgot Password?
              </button>
            </div>

            {/* Sign In Button */}
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-6 text-base"
            >
              Sign In
            </Button>
          </form>
        </div>
      </div>

      {/* Show Desktop Link */}
      <button
        type="button"
        onClick={() => setShowDesktop(true)}
        className="absolute bottom-6 right-6 text-white text-sm hover:underline z-10"
      >
        Show desktop
      </button>
    </div>
  );
}