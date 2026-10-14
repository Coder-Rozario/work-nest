import { useState, useEffect } from "react"
import { Save, Lock } from "lucide-react";
import { adminAPI, authAPI } from "../../services/api";

const AdminSettings = () => {
  const [profileData, setProfileData] = useState({
    companyName: "",
    company_name: "",
    industry: "",
    size: "",
    company_size: "",
    email: "",
    phone: "",
    address: "",
  })

  const [passwordData, setPasswordData] = useState({
    current: "",
    current_password: "",
    new: "",
    new_password: "",
    confirm: "",
  })

  const [saveMessage, setSaveMessage] = useState("")
  const [saveType, setSaveType] = useState("success");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const fetchSettings = async () => {
    try {
      const data = await adminAPI.getSettings();
      const settings = data || {};
      setProfileData({
        companyName: settings.company_name || settings.companyName || "",
        company_name: settings.company_name || settings.companyName || "",
        industry: settings.industry || "",
        size: settings.company_size || settings.size || "",
        company_size: settings.company_size || settings.size || "",
        email: settings.email || "",
        phone: settings.phone || "",
        address: settings.address || "",
      });
    } catch (err) {
      console.error("Error fetching settings:", err);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        await fetchSettings();
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleProfileChange = (e) => {
    const { name, value } = e.target
    const next = { ...profileData, [name]: value };
    if (name === "companyName") {
      next.company_name = value;
    } else if (name === "company_name") {
      next.companyName = value;
    } else if (name === "size") {
      next.company_size = value;
    } else if (name === "company_size") {
      next.size = value;
    }
    setProfileData(next);
  }

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    const next = { ...passwordData, [name]: value };
    if (name === "current") {
      next.current_password = value;
    } else if (name === "current_password") {
      next.current = value;
    } else if (name === "new") {
      next.new_password = value;
    } else if (name === "new_password") {
      next.new = value;
    }
    setPasswordData(next);
  }

  const showToast = (message, type = "success") => {
    setSaveMessage(message);
    setSaveType(type);
    setTimeout(() => setSaveMessage(""), 3000);
  };

  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true);
      const payload = {
        company_name: profileData.company_name || profileData.companyName,
        industry: profileData.industry,
        company_size: profileData.company_size || profileData.size,
        email: profileData.email,
        phone: profileData.phone,
        address: profileData.address,
      };

      await adminAPI.updateSettings(payload);
      showToast("Profile settings saved successfully!", "success");
    } catch (err) {
      console.error("Error saving profile:", err);
      showToast(err.message || "Failed to save profile", "error");
    } finally {
      setSavingProfile(false);
    }
  }

  const handleChangePassword = async () => {
    if (passwordData.new !== passwordData.confirm) {
      showToast("Passwords do not match!", "error");
      return;
    }
    if (!passwordData.current || !passwordData.new) {
      showToast("Please fill all password fields", "error");
      return;
    }

    try {
      setSavingPassword(true);
      const payload = {
        current_password: passwordData.current_password || passwordData.current,
        new_password: passwordData.new_password || passwordData.new,
      };

      await authAPI.changePassword(payload);
      showToast("Password changed successfully!", "success");
      setPasswordData({
        current: "",
        current_password: "",
        new: "",
        new_password: "",
        confirm: "",
      });
    } catch (err) {
      console.error("Error changing password:", err);
      const msg = err.response?.data?.message || err.message || "Failed to change password";
      showToast(msg, "error");
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-center">Loading settings...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Profile Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                  <input
                    type="text"
                    name="companyName"
                    value={profileData.companyName}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Industry</label>
                  <input
                    type="text"
                    name="industry"
                    value={profileData.industry}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company Size</label>
                  <input
                    type="text"
                    name="size"
                    value={profileData.size}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={profileData.email}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={profileData.phone}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                  <input
                    type="text"
                    name="address"
                    value={profileData.address}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2 rounded-lg font-medium"
                >
                  <Save className="h-4 w-4" />
                  {savingProfile ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Password</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
                  <input
                    type="password"
                    name="current"
                    value={passwordData.current}
                    onChange={handlePasswordChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                  <input
                    type="password"
                    name="new"
                    value={passwordData.new}
                    onChange={handlePasswordChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    name="confirm"
                    value={passwordData.confirm}
                    onChange={handlePasswordChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  onClick={handleChangePassword}
                  disabled={savingPassword}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2 rounded-lg font-medium"
                >
                  <Lock className="h-4 w-4" />
                  {savingPassword ? "Changing..." : "Change Password"}
                </button>

                {saveMessage && (
                  <div className={`mt-2 p-2 rounded text-sm ${saveType === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {saveMessage}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
};

export default AdminSettings;
