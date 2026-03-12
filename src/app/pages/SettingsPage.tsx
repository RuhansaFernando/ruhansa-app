import { useAuth } from "../AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Switch } from "../components/ui/switch";
import {
  Mail,
  Phone,
  MapPin,
  Edit,
  Save,
  X,
  Hash,
  GraduationCap,
  Calendar,
  BookOpen,
  Clock,
  Users2,
  Award,
  Bell,
  Loader2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
const profileImage = "";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useData } from "../DataContext";
import { db } from "../../firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";

export default function SettingsPage() {
  const { user } = useAuth();
  const { students } = useData();
  const [isEditing, setIsEditing] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const studentData = students.find((s) => s.id === user?.id);

  const [formData, setFormData] = useState({
    phone: "",
    address: "",
    city: "",
  });

  // Track original values so Cancel can revert
  const [savedFormData, setSavedFormData] = useState({
    phone: "",
    address: "",
    city: "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // ── Fetch admin profile from Firestore on mount ──────────────────────────────
  useEffect(() => {
    if (user?.role !== "admin") return;

    const fetchOrCreateAdminDoc = async () => {
      setProfileLoading(true);
      try {
        const adminRef = doc(db, "admin", user.id);
        const adminSnap = await getDoc(adminRef);

        if (adminSnap.exists()) {
          const d = adminSnap.data();
          const loaded = {
            phone: d.phone ?? "",
            address: d.address ?? "",
            city: d.city ?? "",
          };
          setFormData(loaded);
          setSavedFormData(loaded);
        } else {
          // First time – create the document with basic info
          const initial = {
            name: user.name,
            email: user.email,
            password: "",
            role: "admin",
            phone: "",
            address: "",
            city: "",
            createdAt: serverTimestamp(),
          };
          await setDoc(adminRef, initial);
          setFormData({ phone: "", address: "", city: "" });
          setSavedFormData({ phone: "", address: "", city: "" });
        }
      } catch (err) {
        console.error("Failed to load admin profile:", err);
      } finally {
        setProfileLoading(false);
      }
    };

    fetchOrCreateAdminDoc();
  }, [user]);

  const [notificationSettings, setNotificationSettings] = useState({
    emailAppointments: true,
    emailGrades: true,
    emailAlerts: true,
    emailResources: false,
    smsAppointments: true,
    smsAlerts: true,
    pushAppointments: true,
    pushGrades: true,
    pushAlerts: true,
    weeklyDigest: false,
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNotificationChange = (setting: string, value: boolean) => {
    setNotificationSettings((prev) => ({ ...prev, [setting]: value }));
    toast.success("Notification preferences updated");
  };

  const handleSave = async () => {
    if (user?.role === "admin") {
      setSaving(true);
      try {
        await updateDoc(doc(db, "admin", user.id), {
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          updatedAt: serverTimestamp(),
        });
        setSavedFormData({ ...formData });
        toast.success("Profile updated successfully!");
        setIsEditing(false);
      } catch (err) {
        console.error(err);
        toast.error("Failed to save profile. Please try again.");
      } finally {
        setSaving(false);
      }
    } else {
      toast.success("Profile updated successfully!");
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setFormData({ ...savedFormData });
    setIsEditing(false);
  };

  const handlePasswordUpdate = () => {
    if (
      !passwordData.currentPassword ||
      !passwordData.newPassword ||
      !passwordData.confirmPassword
    ) {
      toast.error("Please fill in all password fields");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    toast.success("Password updated successfully!");

    setPasswordData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Account Settings</h1>
        <p className="text-muted-foreground">
          Manage your personal information, security, and notification
          preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
<TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              {profileLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
              <>
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20 border-2 border-blue-600">
                    <AvatarImage src={profileImage} alt={user?.name} />
                    <AvatarFallback className="text-2xl bg-blue-600 text-white">
                      {user?.name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-2xl font-bold">
                      {user?.name || "Admin"}
                    </h2>
                    <p className="text-muted-foreground">
                      {user?.email || "admin@novara.ac.lk"}
                    </p>
                    {studentData && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {studentData.programme} • Year {studentData.year}
                      </p>
                    )}
                    {user?.role === "admin" && (
                      <p className="text-sm text-blue-600 font-medium mt-1">
                        System Administrator
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <Button
                        variant="outline"
                        className="border-red-600 text-red-600 hover:bg-red-50"
                        onClick={handleCancel}
                        disabled={saving}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                      <Button
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={handleSave}
                        disabled={saving}
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        {saving ? "Saving..." : "Save Changes"}
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="bg-blue-600 hover:bg-blue-700"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Profile
                    </Button>
                  )}
                </div>
              </div>

              <Separator className="mb-6" />

              <div className="space-y-6">
                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Contact Information</h3>

                  <div className="grid gap-4">
                    {/* Email - Read Only */}
                    <div className="flex items-start gap-4">
                      <div className="mt-2">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <Label className="text-muted-foreground">
                          Email Address
                        </Label>
                        <p className="font-medium mt-1">
                          {user?.email || "student@novara.ac.lk"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          This is your university email and cannot be changed
                        </p>
                      </div>
                    </div>

                    {/* Phone - Editable */}
                    <div className="flex items-start gap-4">
                      <div className="mt-2">
                        <Phone className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <Label className="text-muted-foreground">
                          Phone Number
                        </Label>
                        {isEditing ? (
                          <Input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) =>
                              handleInputChange("phone", e.target.value)
                            }
                            className="mt-1"
                            placeholder="+94 XX XXX XXXX"
                          />
                        ) : (
                          <p className="font-medium mt-1">{formData.phone}</p>
                        )}
                      </div>
                    </div>

                    {/* Address - Editable */}
                    <div className="flex items-start gap-4">
                      <div className="mt-2">
                        <MapPin className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <Label className="text-muted-foreground">
                          Home Address
                        </Label>
                        {isEditing ? (
                          <div className="space-y-2 mt-1">
                            <Input
                              type="text"
                              value={formData.address}
                              onChange={(e) =>
                                handleInputChange("address", e.target.value)
                              }
                              placeholder="Street Address"
                            />
                            <Input
                              type="text"
                              value={formData.city}
                              onChange={(e) =>
                                handleInputChange("city", e.target.value)
                              }
                              placeholder="City, Country"
                            />
                          </div>
                        ) : (
                          <div className="mt-1">
                            <p className="font-medium">{formData.address}</p>
                            <p className="font-medium">{formData.city}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Academic Information - Only for Students */}
                {user?.role === "student" && studentData && (
                  <>
                    <Separator />

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">
                          Academic Information
                        </h3>

                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <Hash className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <Label className="text-muted-foreground text-xs">
                                Student ID
                              </Label>
                              <p className="font-medium">{studentData.id}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <GraduationCap className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <Label className="text-muted-foreground text-xs">
                                Program
                              </Label>
                              <p className="font-medium">
                                {studentData.programme}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <Label className="text-muted-foreground text-xs">
                                Year of Study
                              </Label>
                              <p className="font-medium">
                                Year {studentData.year}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <Award className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <Label className="text-muted-foreground text-xs">
                                Current GPA
                              </Label>
                              <p className="font-medium">
                                {studentData.gpa.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">
                          Enrollment Details
                        </h3>

                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <Label className="text-muted-foreground text-xs">
                                Mode
                              </Label>
                              <p className="font-medium">Full-time</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <Label className="text-muted-foreground text-xs">
                                Start Session
                              </Label>
                              <p className="font-medium">2024/2025</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <Label className="text-muted-foreground text-xs">
                                Expected Graduation
                              </Label>
                              <p className="font-medium">2028</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <Users2 className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <Label className="text-muted-foreground text-xs">
                                Academic Advisor
                              </Label>
                              <p className="font-medium">Dr. Sarah Johnson</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
              </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-blue-600" />
                <CardTitle>Notification Preferences</CardTitle>
              </div>
              <CardDescription>
                Manage how you receive updates and reminders
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email Notifications */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Notifications
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Appointment Reminders</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive email reminders 24 hours before appointments
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.emailAppointments}
                      onCheckedChange={(checked) =>
                        handleNotificationChange("emailAppointments", checked)
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Grade Updates</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified when new grades are posted
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.emailGrades}
                      onCheckedChange={(checked) =>
                        handleNotificationChange("emailGrades", checked)
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Academic Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Important alerts from your advisor and faculty
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.emailAlerts}
                      onCheckedChange={(checked) =>
                        handleNotificationChange("emailAlerts", checked)
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Resource Recommendations</Label>
                      <p className="text-sm text-muted-foreground">
                        Personalized suggestions for support services
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.emailResources}
                      onCheckedChange={(checked) =>
                        handleNotificationChange("emailResources", checked)
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* SMS Notifications */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  SMS Notifications
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Appointment Reminders</Label>
                      <p className="text-sm text-muted-foreground">
                        SMS reminders for scheduled appointments
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.smsAppointments}
                      onCheckedChange={(checked) =>
                        handleNotificationChange("smsAppointments", checked)
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Critical Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Urgent notifications requiring immediate attention
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.smsAlerts}
                      onCheckedChange={(checked) =>
                        handleNotificationChange("smsAlerts", checked)
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Push Notifications */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Push Notifications
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Appointment Updates</Label>
                      <p className="text-sm text-muted-foreground">
                        Browser notifications for appointments
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.pushAppointments}
                      onCheckedChange={(checked) =>
                        handleNotificationChange("pushAppointments", checked)
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Grade Postings</Label>
                      <p className="text-sm text-muted-foreground">
                        Instant notifications when grades are available
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.pushGrades}
                      onCheckedChange={(checked) =>
                        handleNotificationChange("pushGrades", checked)
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>System Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Important system and academic notifications
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.pushAlerts}
                      onCheckedChange={(checked) =>
                        handleNotificationChange("pushAlerts", checked)
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Digest */}
              <div className="space-y-4">
                <h3 className="font-semibold">Digest</h3>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Weekly Summary</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive a weekly email with your progress summary
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings.weeklyDigest}
                    onCheckedChange={(checked) =>
                      handleNotificationChange("weeklyDigest", checked)
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
