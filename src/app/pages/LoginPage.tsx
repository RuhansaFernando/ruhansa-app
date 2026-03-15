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
  const [showDesktop, setShowDesktop] = useState(false);
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

      // 1. Check "admin" collection — by UID as document ID, then by "fb-admin" + email fallback
      let adminData: { id: string; name: string } | null = null;

      const adminByUid = await getDoc(doc(db, "admin", firebaseUid));
      if (adminByUid.exists() && adminByUid.data()?.role === "admin") {
        adminData = { id: adminByUid.id, name: adminByUid.data()?.name ?? firebaseEmail };
      } else {
        const adminFallback = await getDoc(doc(db, "admin", "fb-admin"));
        if (adminFallback.exists() && adminFallback.data()?.email === firebaseEmail) {
          adminData = { id: adminFallback.id, name: adminFallback.data()?.name ?? firebaseEmail };
        }
      }

      if (adminData) {
        login({
          id: adminData.id,
          name: adminData.name,
          role: "admin",
          email: firebaseEmail,
          password: "",
        });
        navigate("/admin/dashboard");
      } else {
        // 2. Check "student_support_advisors" collection by email
        const sruQ = query(collection(db, "student_support_advisors"), where("email", "==", firebaseEmail));
        const sruSnap = await getDocs(sruQ);
        if (!sruSnap.empty) {
          const sruDoc = sruSnap.docs[0];
          login({
            id: sruDoc.id,
            name: sruDoc.data().name ?? firebaseEmail,
            role: "sru",
            email: firebaseEmail,
            password: "",
          });
          navigate("/sru/dashboard");
        } else {
        // 3. Check "registry" collection by email
        const regQ = query(collection(db, "registry"), where("email", "==", firebaseEmail));
        const regSnap = await getDocs(regQ);
        if (!regSnap.empty) {
          const regDoc = regSnap.docs[0];
          login({
            id: regDoc.id,
            name: regDoc.data().name ?? firebaseEmail,
            role: "registry",
            email: firebaseEmail,
            password: "",
          });
          navigate("/registry/dashboard");
        } else {
        // 4. Check "faculty_administrators" collection by email
        const acaQ = query(collection(db, "faculty_administrators"), where("email", "==", firebaseEmail));
        const acaSnap = await getDocs(acaQ);
        if (!acaSnap.empty) {
          const acaDoc = acaSnap.docs[0];
          login({
            id: acaDoc.id,
            name: acaDoc.data().name ?? firebaseEmail,
            role: "academic_admin",
            email: firebaseEmail,
            password: "",
          });
          navigate("/academic/upload");
        } else {
        // 5. Check "academic_mentors" collection by email
        const mentorQ = query(collection(db, "academic_mentors"), where("email", "==", firebaseEmail));
        const mentorSnap = await getDocs(mentorQ);
        if (!mentorSnap.empty) {
          const mentorDoc = mentorSnap.docs[0];
          login({
            id: mentorDoc.id,
            name: mentorDoc.data().name ?? firebaseEmail,
            role: "academic_mentor",
            email: firebaseEmail,
            password: "",
          });
          navigate("/mentor/dashboard");
        } else {
        // 6. Check "student_counsellors" collection by email
        const scQ = query(collection(db, "student_counsellors"), where("email", "==", firebaseEmail));
        const scSnap = await getDocs(scQ);
        if (!scSnap.empty) {
          const scDoc = scSnap.docs[0];
          login({
            id: scDoc.id,
            name: scDoc.data().name ?? firebaseEmail,
            role: "student_counsellor",
            email: firebaseEmail,
            password: "",
          });
          navigate("/counsellor/dashboard");
        } else {
        // 7. Check Firestore students collection
        const q = query(
          collection(db, "students"),
          where("email", "==", firebaseEmail),
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const studentDoc = snapshot.docs[0];
          const data = studentDoc.data();
          login({
            id: studentDoc.id,
            name: data.name ?? firebaseEmail,
            role: "student",
            email: firebaseEmail,
            password: "",
          });
          navigate("/student/dashboard");
        } else {
          // 3. Check Firestore faculty collection
          const fq = query(
            collection(db, "faculty"),
            where("email", "==", firebaseEmail),
          );
          const fSnapshot = await getDocs(fq);
          if (!fSnapshot.empty) {
            const facultyDoc = fSnapshot.docs[0];
            const fData = facultyDoc.data();
            login({
              id: facultyDoc.id,
              name: fData.name ?? firebaseEmail,
              role: "faculty",
              email: firebaseEmail,
              password: "",
            });
            navigate("/faculty/dashboard");
          } else {
            // 4. Check Firestore advisors collection
            const aq = query(
              collection(db, "advisors"),
              where("email", "==", firebaseEmail),
            );
            const aSnapshot = await getDocs(aq);
            if (!aSnapshot.empty) {
              const advisorDoc = aSnapshot.docs[0];
              const aData = advisorDoc.data();
              login({
                id: advisorDoc.id,
                name: aData.name ?? firebaseEmail,
                role: "advisor",
                email: firebaseEmail,
                password: "",
              });
              navigate("/advisor/dashboard");
            } else {
              // 5. Check Firestore counselors collection
              const cq = query(
                collection(db, "counselors"),
                where("email", "==", firebaseEmail),
              );
              const cSnapshot = await getDocs(cq);
              if (!cSnapshot.empty) {
                const counselorDoc = cSnapshot.docs[0];
                const cData = counselorDoc.data();
                login({
                  id: counselorDoc.id,
                  name: cData.name ?? firebaseEmail,
                  role: "counselor",
                  email: firebaseEmail,
                  password: "",
                });
                navigate("/counselor/dashboard");
              } else {
                setError(
                  "Your account is not authorised to access this system.",
                );
                await auth.signOut();
              }
            }
          }
        }
        }
        }
        }
        }
        }
      }
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
            <h1 className="text-2xl font-bold">
              Student Risk Management System
            </h1>
            <p className="text-muted-foreground mt-2">
              Demo Accounts - Quick Login
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              variant="outline"
              size="lg"
              className="h-auto flex-col items-start p-4"
              onClick={() => {
                handleQuickLogin("sarah.johnson@university.edu");
                setShowDesktop(false);
              }}
            >
              <span className="font-semibold">Academic Advisor</span>
              <span className="text-xs text-muted-foreground mt-1">
                sarah.johnson@university.edu
              </span>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="h-auto flex-col items-start p-4"
              onClick={() => {
                handleQuickLogin("john.smith@student.edu");
                setShowDesktop(false);
              }}
            >
              <span className="font-semibold">Student (High Risk)</span>
              <span className="text-xs text-muted-foreground mt-1">
                john.smith@student.edu
              </span>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="h-auto flex-col items-start p-4"
              onClick={() => {
                handleQuickLogin("emily.roberts@university.edu");
                setShowDesktop(false);
              }}
            >
              <span className="font-semibold">Faculty Member</span>
              <span className="text-xs text-muted-foreground mt-1">
                emily.roberts@university.edu
              </span>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="h-auto flex-col items-start p-4"
              onClick={() => {
                handleQuickLogin("lisa.anderson@university.edu");
                setShowDesktop(false);
              }}
            >
              <span className="font-semibold">Counselor</span>
              <span className="text-xs text-muted-foreground mt-1">
                lisa.anderson@university.edu
              </span>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="h-auto flex-col items-start p-4 md:col-span-2"
              onClick={() => {
                handleQuickLogin("admin@university.edu");
                setShowDesktop(false);
              }}
            >
              <span className="font-semibold">Administrator</span>
              <span className="text-xs text-muted-foreground mt-1">
                admin@university.edu
              </span>
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
