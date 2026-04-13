import { useState } from "react";
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
const backgroundImage = "";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

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
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md">
        <div
          className="rounded-2xl p-8 shadow-2xl backdrop-blur-xl"
          style={{
            background: "rgba(255, 255, 255, 0.15)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
          }}
        >
          {/* Header */}
          <div className="mb-8">
            <img src="/src/assets/DropGuard_Logo_Final.png" alt="DropGuard" style={{ width: '160px', height: 'auto' }} />
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
              <Label
                htmlFor="password"
                className="text-white text-sm font-medium"
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
                className="bg-white/20 border-white/30 text-white placeholder:text-white/60 backdrop-blur-sm focus:bg-white/30"
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

            {/* Error Message */}
            {error && (
              <div className="rounded-lg bg-red-500/20 border border-red-400/40 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            {/* Sign In Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-6 text-base disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        </div>
      </div>

    </div>
  );
}
