import { useState, useEffect } from "react"
import { Send, Search, User, Loader2, Lock } from "lucide-react"
import { messageAPI } from "../../services/api"
import { getAssetUrl } from "../../config/env"
import { useRealtime } from "../../hooks/useRealtime"

function formatDateTime(createdAt) {
  if (!createdAt) return ""
  const date = new Date(createdAt)
  if (isNaN(date.getTime())) return ""
  const now = new Date()
  const diffMs = now - date
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString()
}

const savedUser = JSON.parse(localStorage.getItem("worknest_user") || "{}")
const currentUserId = Number(savedUser.id)

function normalizeRoleLabel(role) {
  const cleaned = String(role || "employee").trim().toLowerCase()
  if (cleaned === "admin") return "ADMIN"
  if (cleaned === "manager") return "MANAGER"
  return "EMPLOYEE"
}

const ENCRYPTION_KEY = "worknest_secure_v1"

function xorEncrypt(input) {
  const text = String(input ?? "")
  if (!text) return ""

  let result = ""
  for (let i = 0; i < text.length; i += 1) {
    const charCode = text.charCodeAt(i)
    const keyCode = ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)
    const encoded = charCode ^ keyCode
    result += encoded.toString(16).padStart(2, "0")
  }

  return result
}

function xorDecrypt(input) {
  const text = String(input ?? "")
  if (!text.trim()) return ""

  if (text.length % 2 !== 0) {
    return text
  }

  let result = ""
  for (let i = 0; i < text.length; i += 2) {
    const hexPair = text.slice(i, i + 2)
    if (!/^[0-9a-fA-F]{2}$/.test(hexPair)) {
      return text
    }

    const byte = parseInt(hexPair, 16)
    const keyCode = ENCRYPTION_KEY.charCodeAt((i / 2) % ENCRYPTION_KEY.length)
    result += String.fromCharCode(byte ^ keyCode)
  }

  return result
}

function normalizeDisplayText(value) {
  const text = String(value ?? "")
  const decoded = xorDecrypt(text)
  return decoded && decoded.trim() ? decoded.trim() : (text && text.trim() ? text.trim() : "No messages yet")
}

function getImageUrl(photo) {
  const value = photo ?? ""
  if (!value) return ""
  const normalized = typeof value === "string" ? value.trim() : ""
  if (!normalized) return ""
  if (normalized.startsWith("http://") || normalized.startsWith("https://") || normalized.startsWith("data:")) {
    return normalized
  }
  return getAssetUrl(normalized)
}

function resolveProfilePhoto(item) {
  if (!item) return ""
  const photo =
    item.profile_photo ||
    item.profilePhoto ||
    item.avatar ||
    item.photo ||
    item.image ||
    item.user?.profile_photo ||
    item.user?.profilePhoto ||
    item.user?.avatar ||
    item.user?.photo ||
    item.user?.image ||
    ""

  return getImageUrl(photo)
}

const Messages = function () {
  const [contacts, setContacts] = useState([])
  const [selectedContact, setSelectedContact] = useState(null)
  const [currentMessages, setCurrentMessages] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [newMessage, setNewMessage] = useState("")
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [error, setError] = useState("")

  const fetchConversations = async () => {
    try {
      setLoadingConversations(true)
      setError("")
      const response = await messageAPI.getConversations()
      const mapped = (response || []).map((conv) => ({
        id: conv.id,
        name: conv.full_name || conv.name || conv.email || "Unknown User",
        email: conv.email || "",
        team: conv.team_name || conv.team || "",
        teamName: conv.team_name || conv.team || "",
        profilePhoto: resolveProfilePhoto(conv),
        lastMessage: normalizeDisplayText(conv.content || conv.encrypted_text || "No messages yet"),
        time: formatDateTime(conv.created_at),
        role: normalizeRoleLabel(conv.role || "employee"),
      }))
      setContacts(mapped)
    } catch (err) {
      console.error("Failed to load conversations:", err)
      setError("Failed to load conversations")
    } finally {
      setLoadingConversations(false)
    }
  }

  const fetchMessages = async (userId) => {
    try {
      setLoadingMessages(true)
      const response = await messageAPI.getMessages(userId)
      const otherUser = contacts.find((c) => Number(c.id) === Number(userId)) || { name: "Unknown" }
      const mapped = (response || []).map((msg) => {
        const isSent = Number(msg.sender_id) === Number(currentUserId)
        const text = normalizeDisplayText(msg.display_text || msg.encrypted_text || msg.content || "Encrypted message")
        return {
          id: msg.id,
          sender: isSent ? "You" : otherUser.name,
          content: text,
          time: formatDateTime(msg.created_at),
          type: isSent ? "sent" : "received",
        }
      })
      setCurrentMessages([...mapped].reverse())
    } catch (err) {
      console.error("Failed to load messages:", err)
      setError("You are not allowed to access this conversation.")
    } finally {
      setLoadingMessages(false)
    }
  }

  useEffect(() => {
    void (async () => {
      await fetchConversations()
    })()
  }, [])

  useRealtime('messages', () => {
    void fetchConversations()
    if (selectedContact) void fetchMessages(selectedContact.id)
  })

  const filteredContacts = contacts.filter(function (contact) {
    const term = searchTerm.toLowerCase()
    return (
      contact.name.toLowerCase().includes(term) ||
      contact.team.toLowerCase().includes(term) ||
      contact.role.toLowerCase().includes(term) ||
      String(contact.id).includes(term)
    )
  })

  function selectContact(contact) {
    setSelectedContact(contact)
    fetchMessages(contact.id)
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedContact) return
    try {
      const encryptedText = xorEncrypt(newMessage.trim())
      setSendingMessage(true)
      await messageAPI.sendMessage({
        receiver_id: Number(selectedContact.id),
        content: encryptedText,
        encrypted_text: encryptedText,
      })
      setNewMessage("")
      await fetchMessages(selectedContact.id)
      await fetchConversations()
    } catch (err) {
      console.error("Failed to send message:", err)
      setError("You are not allowed to message this user.")
    } finally {
      setSendingMessage(false)
    }
  }

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <div className="mx-auto h-[calc(100vh-12rem)] max-w-6xl min-h-0">
        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="grid h-full grid-cols-1 gap-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-b border-slate-200 bg-slate-50 lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-200 p-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search contacts, team, role or ID..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loadingConversations ? (
                <div className="flex h-full items-center justify-center p-5">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : (
                <>
                  {filteredContacts.map(function (contact) {
                    return (
                      <button
                        key={contact.id}
                        onClick={function () { selectContact(contact) }}
                        className={`w-full border-b border-slate-100 px-4 py-3 text-left transition ${Number(selectedContact?.id) === Number(contact.id) ? "bg-blue-50 shadow-inner" : "hover:bg-slate-100/80"}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="relative mt-0.5">
                            {contact.profilePhoto ? (
                              <img src={contact.profilePhoto} alt={contact.name} className="h-11 w-11 rounded-full object-cover border border-slate-200" />
                            ) : (
                              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-linear-to-br from-slate-200 to-slate-300 text-sm font-semibold text-slate-700">
                                {contact.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-semibold text-slate-800">{contact.name}</p>
                              <span className="text-[10px] text-slate-500">{contact.time}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{contact.team}</p>
                              </div>
                              <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-600">
                                {contact.role || "EMPLOYEE"}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                              <Lock className="h-3 w-3 text-slate-400" />
                              <p className="truncate">{contact.lastMessage}</p>
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                  {filteredContacts.length == 0 && (
                    <div className="flex h-full items-center justify-center p-5 text-sm text-slate-500">No contact found</div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col bg-white">
            {selectedContact ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {selectedContact.profilePhoto ? (
                        <img src={selectedContact.profilePhoto} alt={selectedContact.name} className="h-10 w-10 rounded-full object-cover border border-slate-200" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-slate-200 to-slate-300 text-sm font-semibold text-slate-700">
                          {selectedContact.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{selectedContact.name}</p>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">{selectedContact.role || "EMPLOYEE"}</p>
                      <p className="text-[10px] text-slate-500">{selectedContact.team || ""} • ID: {selectedContact.id}</p>
                    </div>
                  </div>
                </div>
            
                <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4">
                  {loadingMessages ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {currentMessages.map(function (msg) {
                        return (
                          <div key={msg.id} className={`flex ${msg.type == "sent" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${msg.type === "sent" ? "rounded-br-md bg-blue-600 text-white" : "rounded-bl-md bg-white text-slate-800"}`}>
                              <div className="mb-1 flex items-center gap-1 text-[10px] opacity-80">
                                <Lock className="h-3 w-3" />
                                <span>{msg.type === "sent" ? "Encrypted to recipient" : "Encrypted message"}</span>
                              </div>
                              <p className="text-sm leading-6 wrap-break-word">{msg.content}</p>
                              <p className={`mt-1 text-[10px] ${msg.type == "sent" ? "text-blue-100" : "text-slate-500"}`}>{msg.time}</p>
                            </div>
                          </div>
                        )
                      })}
                      {currentMessages.length == 0 && (
                        <div className="flex h-full items-center justify-center text-sm text-slate-500">No messages yet. Start the conversation!</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 bg-white p-3">
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-2 shadow-sm">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(event) => setNewMessage(event.target.value)}
                      onKeyDown={function (event) { if (event.key == "Enter" && !sendingMessage) sendMessage() }}
                      disabled={sendingMessage}
                      className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 disabled:opacity-60"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={sendingMessage}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-60"
                      aria-label="Send message"
                    >
                      {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-500">
                <div className="text-center">
                  <User className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                  <p>Select a contact to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Messages
