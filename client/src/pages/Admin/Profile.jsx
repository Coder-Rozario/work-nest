import { useState } from "react"
import ProfilePage from "../Profile/ProfilePage"
import useRealtime from "../../hooks/useRealtime"

const AdminProfile = () => {
  const [refreshKey, setRefreshKey] = useState(0)

  useRealtime(['profile', 'settings'], () => {
    setRefreshKey((current) => current + 1)
  })

  return <ProfilePage key={refreshKey} roleLabel="Admin" />
}

export default AdminProfile
