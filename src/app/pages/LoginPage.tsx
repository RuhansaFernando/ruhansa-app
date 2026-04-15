import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../AuthContext";
import { auth, db } from "../../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { collection, getDocs, getDoc, doc, query, where } from "firebase/firestore";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import logoUrl from "../../assets/DropGuard_Logo_Final.png";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setEmail("");
    setPassword("");
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const firebaseEmail = credential.user.email ?? "";
      const firebaseUid = credential.user.uid;

      // 1. admin — by UID doc ID, then "fb-admin" email fallback
      const adminByUid = await getDoc(doc(db, "admin", firebaseUid));
      if (adminByUid.exists() && adminByUid.data()?.role === "admin") {
        login({ id: adminByUid.id, name: adminByUid.data()?.name ?? firebaseEmail, role: "admin", email: firebaseEmail }, rememberMe);
        navigate("/admin/dashboard");
        return;
      }
      const adminFallback = await getDoc(doc(db, "admin", "fb-admin"));
      if (adminFallback.exists() && adminFallback.data()?.email === firebaseEmail) {
        login({ id: adminFallback.id, name: adminFallback.data()?.name ?? firebaseEmail, role: "admin", email: firebaseEmail }, rememberMe);
        navigate("/admin/dashboard");
        return;
      }

      // 2. students — checked BEFORE all staff collections to prevent email collision
      //    Primary: match by uid field (most reliable, uid is unique)
      //    Fallback: match by email (for records without uid set)
      const studentUidSnap = await getDocs(query(collection(db, "students"), where("uid", "==", firebaseUid)));
      if (!studentUidSnap.empty) {
        const d = studentUidSnap.docs[0];
        login({ id: d.id, name: d.data().name ?? firebaseEmail, role: "student", email: firebaseEmail }, rememberMe);
        navigate("/student/dashboard");
        return;
      }
      const studentEmailSnap = await getDocs(query(collection(db, "students"), where("email", "==", firebaseEmail)));
      if (!studentEmailSnap.empty) {
        const d = studentEmailSnap.docs[0];
        login({ id: d.id, name: d.data().name ?? firebaseEmail, role: "student", email: firebaseEmail }, rememberMe);
        navigate("/student/dashboard");
        return;
      }

      // 3. student_support_advisors
      const sruSnap = await getDocs(query(collection(db, "student_support_advisors"), where("email", "==", firebaseEmail)));
      if (!sruSnap.empty) {
        const d = sruSnap.docs[0];
        login({ id: d.id, name: d.data().name ?? firebaseEmail, role: "sru", email: firebaseEmail, mustChangePassword: d.data().mustChangePassword ?? false, firestoreCollection: "student_support_advisors" }, rememberMe);
        navigate("/sru/dashboard");
        return;
      }

      // 4. registry
      const regSnap = await getDocs(query(collection(db, "registry"), where("email", "==", firebaseEmail)));
      if (!regSnap.empty) {
        const d = regSnap.docs[0];
        login({ id: d.id, name: d.data().name ?? firebaseEmail, role: "registry", email: firebaseEmail, mustChangePassword: d.data().mustChangePassword ?? false, firestoreCollection: "registry" }, rememberMe);
        navigate("/registry/dashboard");
        return;
      }

      // 5. faculty_administrators
      const acaSnap = await getDocs(query(collection(db, "faculty_administrators"), where("email", "==", firebaseEmail)));
      if (!acaSnap.empty) {
        const d = acaSnap.docs[0];
        login({ id: d.id, name: d.data().name ?? firebaseEmail, role: "academic_admin", email: firebaseEmail, mustChangePassword: d.data().mustChangePassword ?? false, firestoreCollection: "faculty_administrators" }, rememberMe);
        navigate("/academic/dashboard");
        return;
      }

      // 6. academic_mentors
      const mentorSnap = await getDocs(query(collection(db, "academic_mentors"), where("email", "==", firebaseEmail)));
      if (!mentorSnap.empty) {
        const d = mentorSnap.docs[0];
        login({ id: d.id, name: d.data().name ?? firebaseEmail, role: "academic_mentor", email: firebaseEmail, mustChangePassword: d.data().mustChangePassword ?? false, firestoreCollection: "academic_mentors" }, rememberMe);
        navigate("/mentor/dashboard");
        return;
      }

      // 7. course_leaders
      const clSnap = await getDocs(query(collection(db, "course_leaders"), where("email", "==", firebaseEmail)));
      if (!clSnap.empty) {
        const d = clSnap.docs[0];
        login({ id: d.id, name: d.data().name ?? firebaseEmail, role: "course_leader", email: firebaseEmail, mustChangePassword: d.data().mustChangePassword ?? false, firestoreCollection: "course_leaders" }, rememberMe);
        navigate("/course-leader/dashboard");
        return;
      }

      // 8. legacy collections (faculty, advisors, counselors)
      const fSnap = await getDocs(query(collection(db, "faculty"), where("email", "==", firebaseEmail)));
      if (!fSnap.empty) {
        const d = fSnap.docs[0];
        login({ id: d.id, name: d.data().name ?? firebaseEmail, role: "faculty", email: firebaseEmail }, rememberMe);
        navigate("/faculty/dashboard");
        return;
      }
      const aSnap = await getDocs(query(collection(db, "advisors"), where("email", "==", firebaseEmail)));
      if (!aSnap.empty) {
        const d = aSnap.docs[0];
        login({ id: d.id, name: d.data().name ?? firebaseEmail, role: "advisor", email: firebaseEmail }, rememberMe);
        navigate("/advisor/dashboard");
        return;
      }
      const cSnap = await getDocs(query(collection(db, "counselors"), where("email", "==", firebaseEmail)));
      if (!cSnap.empty) {
        const d = cSnap.docs[0];
        login({ id: d.id, name: d.data().name ?? firebaseEmail, role: "counselor", email: firebaseEmail }, rememberMe);
        navigate("/counselor/dashboard");
        return;
      }

      setError("Your account is not authorised to access this system.");
      await auth.signOut();
    } catch (err) {
      if (err instanceof FirebaseError) {
        switch (err.code) {
          case "auth/invalid-credential":
          case "auth/wrong-password":
          case "auth/user-not-found":
            setError("Invalid email or password. Please try again.");
            break;
          case "auth/invalid-email":
            setError("Please enter a valid email address.");
            break;
          case "auth/too-many-requests":
            setError("Too many failed attempts. Please try again later.");
            break;
          case "auth/user-disabled":
            setError(
              "This account has been disabled. Contact your administrator.",
            );
            break;
          default:
            setError("An error occurred during sign in. Please try again.");
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: `url('https://images.unsplash.com/photo-1562774053-701939374585?w=1920&q=80')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/55" />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md">
        <div
          className="rounded-2xl p-8 shadow-2xl backdrop-blur-xl"
          style={{
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            boxShadow: "0 25px 50px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.05)",
          }}
        >
          {/* Logo */}
          <div className="mb-8">
            <img src={logoUrl} alt="DropGuard" style={{ width: "160px", height: "auto" }} />
          </div>

          {/* Sign in heading */}
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-white mb-1.5">Sign in</h2>
            <p className="text-white/60 text-sm">
              Enter your credentials to access your account
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5" autoComplete="off">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-white/85 text-sm font-medium">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="off"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/35 focus:bg-white/15 focus:border-white/40 focus-visible:ring-white/20"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-white/85 text-sm font-medium"
              >
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/35 focus:bg-white/15 focus:border-white/40 focus-visible:ring-white/20"
              />
            </div>

            {/* Remember me and Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) =>
                    setRememberMe(checked as boolean)
                  }
                  className="border-white/40 data-[state=checked]:bg-white data-[state=checked]:text-blue-700"
                />
                <label
                  htmlFor="remember"
                  className="text-sm text-white/75 cursor-pointer select-none"
                >
                  Remember me
                </label>
              </div>
              <button
                type="button"
                className="text-sm text-blue-300 hover:text-blue-200 transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-lg bg-red-500/15 border border-red-400/30 px-4 py-3">
                <svg
                  className="w-4 h-4 text-red-300 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            {/* Sign In Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold py-6 text-base transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ boxShadow: "0 4px 20px rgba(37, 99, 235, 0.4)" }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Signing in…
                </span>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-white/30">
            &copy; {new Date().getFullYear()} DropGuard &middot; Student Support Platform
          </p>
        </div>
      </div>
    </div>
  );
}
