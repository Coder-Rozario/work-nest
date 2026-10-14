const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/api\/?$/, "").replace(/\/+$/, "")

export const API_BASE_URL = API_URL
export const API_ROOT_URL = `${API_BASE_URL}/api`

export const getApiUrl = (path = "") => {
  const normalizedPath = String(path || "").replace(/^\/+/, "")
  return normalizedPath ? `${API_ROOT_URL}/${normalizedPath}` : API_ROOT_URL
}

export const getAssetUrl = (path = "") => {
  if (!path) return ""

  if (String(path).startsWith("http://") || String(path).startsWith("https://")) {
    return path
  }

  const normalizedPath = String(path).replace(/^\/+/, "")
  return `${API_BASE_URL}/${normalizedPath}`
}
