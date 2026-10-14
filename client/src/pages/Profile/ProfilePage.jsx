import { useEffect, useState } from "react"
import { Mail, Phone, MapPin, Lock, Save, Upload } from "lucide-react"
import { employeeAPI } from "../../services/api"
import ChangePasswordModal from "../../components/ChangePasswordModal"
import { getAssetUrl, getApiUrl } from "../../config/env"

const buildImageUrl = (photo) => {
  if (!photo) return ""
  return getAssetUrl(photo)
}

const ProfilePage = ({ roleLabel = "Employee" }) => {
  const [profileData, setProfileData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [formData, setFormData] = useState({})
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [uploading, setUploading] = useState(false)

  const loadProfile = async () => {
    try {
      setLoading(true)
      const data = await employeeAPI.getProfile()
      const fullNameFromApi = data?.full_name || `${data?.first_name || ""} ${data?.last_name || ""}`.trim()
      setProfileData(data && typeof data === "object" ? data : {})
      setFormData({
        full_name: fullNameFromApi || "",
        first_name: data?.first_name || "",
        last_name: data?.last_name || "",
        email: data?.email || "",
        phone: data?.phone || "",
        position: data?.position || "",
        location: data?.address || data?.location || "",
      })
    } catch {
      setProfileData({})
      setFormData({})
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  const handleInputChange = (e) => {
    const name = e.target.name
    const value = e.target.value
    setFormData({ ...formData, [name]: value })
  }

  const handleSave = async () => {
    try {
      await employeeAPI.updateProfile({
        full_name: formData.full_name,
        first_name: formData.first_name,
        last_name: formData.last_name,
        position: formData.position,
      })
      setEditMode(false)
      await loadProfile()
    } catch {
      window.alert("Could not save profile. Please try again.")
    }
  }

  const handlePhotoUpload = async (event) => {
    const file = event.target.files && event.target.files[0]
    if (!file) return

    try {
      setUploading(true)
      const formData = new FormData()
      formData.append('photo', file)

      const response = await fetch(getApiUrl('users/profile-photo'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('worknest_token')}`,
        },
        body: formData,
      })

      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Photo upload failed')
      }

      await loadProfile()
    } catch (error) {
      window.alert(error.message || 'Could not upload photo.')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-50 p-6 text-center text-slate-500">Loading profile...</div>
  }

  const fullName = (profileData?.full_name || `${profileData?.first_name || ""} ${profileData?.last_name || ""}`.trim())
  const initials = ((profileData?.first_name || profileData?.full_name || "?").charAt(0) + (profileData?.last_name || profileData?.full_name || "?").charAt(0)).toUpperCase()
  const joinDate = profileData?.created_at
    ? new Date(profileData.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "N/A"
  const profileImage = buildImageUrl(profileData?.profile_photo)

  return (
    <>
      <div className="min-h-screen bg-slate-50 p-6 lg:p-10">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-center relative">
                {profileImage ? (
                  <img src={profileImage} alt={fullName || "Profile"} className="h-20 w-20 rounded-full object-cover border border-slate-200" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white">
                    {initials}
                  </div>
                )}

                <label className="absolute -bottom-2 -right-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white bg-blue-600 text-white shadow-sm hover:bg-blue-700">
                  <Upload className="h-4 w-4" />
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                </label>
              </div>
              <h2 className="text-center text-lg font-semibold text-slate-900">{fullName.trim() || "Your Name"}</h2>
              <p className="mt-1 text-center text-sm text-slate-500">{profileData?.position || roleLabel}</p>
              <p className="mt-1 text-center text-xs text-slate-400">{profileData?.company_name || profileData?.role || roleLabel}</p>

              <div className="mt-6 space-y-3 border-t border-slate-200 pt-4">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Phone className="h-4 w-4" />
                  <span>{profileData?.phone || "No phone"}</span>
                </div>
                <div className="flex items-center gap-2 break-all text-sm text-slate-600">
                  <Mail className="h-4 w-4" />
                  <span>{profileData?.email || "No email"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin className="h-4 w-4" />
                  <span>{profileData?.address || profileData?.location || "No location"}</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Personal Information</h2>
                  <button
                    type="button"
                    onClick={() => setEditMode(!editMode)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
                  >
                    {editMode ? "Cancel" : "Edit"}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-500">Full Name</label>
                    <input
                      type="text"
                      name="full_name"
                      value={formData.full_name || ""}
                      onChange={handleInputChange}
                      disabled={!editMode}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-600"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-500">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email || ""}
                      onChange={handleInputChange}
                      disabled
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone || ""}
                      onChange={handleInputChange}
                      disabled
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">Location</label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location || ""}
                      onChange={handleInputChange}
                      disabled
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">Position</label>
                    <input
                      type="text"
                      name="position"
                      value={formData.position || ""}
                      onChange={handleInputChange}
                      disabled={!editMode}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">Role</label>
                    <input
                      type="text"
                      value={profileData?.role || roleLabel}
                      disabled
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">Join Date</label>
                    <input
                      type="text"
                      value={joinDate}
                      disabled
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                    />
                  </div>
                </div>

                {editMode && (
                  <button
                    type="button"
                    onClick={handleSave}
                    className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700"
                  >
                    <Save className="h-4 w-4" />
                    Save Changes
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <Lock className="h-5 w-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">Change Password</p>
                      <p className="text-xs text-slate-500">Update your security settings</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPasswordModal(true)}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
                    >
                      Change
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ChangePasswordModal open={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
    </>
  )
}

export default ProfilePage
