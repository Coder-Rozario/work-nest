import { Navigate, Route, Routes } from "react-router-dom"

import Login from "./pages/Authentication/Login"
import ForgotPassword from "./pages/Authentication/ForgotPassword"
import Registration from "./pages/Authentication/Registration"

import AdminOverview from "./pages/Admin/Overview"
import ManagerOverview from "./pages/Manager/Overview"
import EmployeeOverview from "./pages/Employee/Overview"
import PageLayouts from "./layouts/pagelayouts"

import AdminEmployeesAndRoles from "./pages/Admin/EmployeesAndRoles"
import AdminTeams from "./pages/Admin/Teams"
import AdminProjects from "./pages/Admin/Projects"
import AdminTask from "./pages/Admin/Task"
import AdminTimeAttendance from "./pages/Admin/TimeAttendance"
import AdminReports from "./pages/Admin/Reports"
import AdminProfile from "./pages/Admin/Profile"

import ManagerMyTeam from "./pages/Manager/MyTeam"
import ManagerProjects from "./pages/Manager/Projects"
import ManagerTasks from "./pages/Manager/Tasks"
import ManagerTimeAttendance from "./pages/Manager/TimeAttendance"
import ManagerReports from "./pages/Manager/Reports"
import ManagerProfile from "./pages/Manager/Profile"

import EmployeeMyTeam from "./pages/Employee/MyTeam"
import EmployeeMyTasks from "./pages/Employee/Mytasks"
import EmployeeMyProjects from "./pages/Employee/MyProjects"
import EmployeeTimeLog from "./pages/Employee/Timelog"
import EmployeeMyProfile from "./pages/Employee/MyProfile"

import Meetings from "./pages/Meetings/Meetings"
import Messages from "./pages/Messages/Messages"

const normalizeRole = (role) => String(role || "").trim().toLowerCase();

const LOCK_COOKIE_NAME = "worknest_locked";

const getCookieValue = (name) => {
  if (typeof document === "undefined") {
    return "";
  }

  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
};

const hasLockCookie = () => getCookieValue(LOCK_COOKIE_NAME) === "1";

const getStoredUserRole = () => {
  try {
    const savedUser = JSON.parse(localStorage.getItem("worknest_user") || "null");
    const role = normalizeRole(savedUser?.role);

    if (role === "manager") return "/manager/overview";
    if (role === "employee") return "/employee/overview";
    return "/admin/overview";
  } catch {
    return "/admin/overview";
  }
};

const ProtectedRoute = ({ children, allowedRole }) => {
  const savedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("worknest_user") || "null");
    } catch {
      return null;
    }
  })();

  const token = localStorage.getItem("worknest_token");
  const role = normalizeRole(savedUser?.role);

  if (hasLockCookie()) {
    localStorage.removeItem("worknest_token");
    localStorage.removeItem("worknest_user");
    localStorage.removeItem("worknest_remember_me");
    return <Navigate to="/login" replace />;
  }

  if (!token || !savedUser?.id) {
    return <Navigate to="/login" replace />;
  }

  if (role && role !== normalizeRole(allowedRole)) {
    return <Navigate to={getStoredUserRole()} replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/forgot_Password" element={<ForgotPassword />} />
      <Route path="/registration" element={<Registration />} />

      <Route element={<PageLayouts />}>
        <Route path="/" element={<Navigate to={getStoredUserRole()} replace />} />
        <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />
        <Route path="/manager" element={<Navigate to="/manager/overview" replace />} />
        <Route path="/employee" element={<Navigate to="/employee/overview" replace />} />

        <Route path="/admin/overview" element={<ProtectedRoute allowedRole="admin"><AdminOverview /></ProtectedRoute>} />
        <Route path="/manager/overview" element={<ProtectedRoute allowedRole="manager"><ManagerOverview /></ProtectedRoute>} />
        <Route path="/employee/overview" element={<ProtectedRoute allowedRole="employee"><EmployeeOverview /></ProtectedRoute>} />

        <Route path="/Admin/employees" element={<ProtectedRoute allowedRole="admin"><AdminEmployeesAndRoles /></ProtectedRoute>} />
        <Route path="/Admin/employees-and-roles" element={<ProtectedRoute allowedRole="admin"><AdminEmployeesAndRoles /></ProtectedRoute>} />
        <Route path="/Admin/teams" element={<ProtectedRoute allowedRole="admin"><AdminTeams /></ProtectedRoute>} />
        <Route path="/Admin/projects" element={<ProtectedRoute allowedRole="admin"><AdminProjects /></ProtectedRoute>} />
        <Route path="/Admin/tasks" element={<ProtectedRoute allowedRole="admin"><AdminTask /></ProtectedRoute>} />
        <Route path="/Admin/time-attendance" element={<ProtectedRoute allowedRole="admin"><AdminTimeAttendance /></ProtectedRoute>} />
        <Route path="/Admin/meetings" element={<ProtectedRoute allowedRole="admin"><Meetings /></ProtectedRoute>} />
        <Route path="/Admin/messages" element={<ProtectedRoute allowedRole="admin"><Messages /></ProtectedRoute>} />
        <Route path="/Admin/reports" element={<ProtectedRoute allowedRole="admin"><AdminReports /></ProtectedRoute>} />
        <Route path="/Admin/profile" element={<ProtectedRoute allowedRole="admin"><AdminProfile /></ProtectedRoute>} />
        <Route path="/Admin/settings" element={<ProtectedRoute allowedRole="admin"><AdminProfile /></ProtectedRoute>} />

        <Route path="/manager/my-team" element={<ProtectedRoute allowedRole="manager"><ManagerMyTeam /></ProtectedRoute>} />
        <Route path="/manager/projects" element={<ProtectedRoute allowedRole="manager"><ManagerProjects /></ProtectedRoute>} />
        <Route path="/manager/tasks" element={<ProtectedRoute allowedRole="manager"><ManagerTasks /></ProtectedRoute>} />
        <Route path="/manager/time-attendance" element={<ProtectedRoute allowedRole="manager"><ManagerTimeAttendance /></ProtectedRoute>} />
        <Route path="/manager/meetings" element={<ProtectedRoute allowedRole="manager"><Meetings /></ProtectedRoute>} />
        <Route path="/manager/messages" element={<ProtectedRoute allowedRole="manager"><Messages /></ProtectedRoute>} />
        <Route path="/manager/reports" element={<ProtectedRoute allowedRole="manager"><ManagerReports /></ProtectedRoute>} />
        <Route path="/manager/profile" element={<ProtectedRoute allowedRole="manager"><ManagerProfile /></ProtectedRoute>} />
        <Route path="/manager/settings" element={<ProtectedRoute allowedRole="manager"><ManagerProfile /></ProtectedRoute>} />

        <Route path="/employee/my-team" element={<ProtectedRoute allowedRole="employee"><EmployeeMyTeam /></ProtectedRoute>} />
        <Route path="/employee/my-tasks" element={<ProtectedRoute allowedRole="employee"><EmployeeMyTasks /></ProtectedRoute>} />
        <Route path="/employee/my-projects" element={<ProtectedRoute allowedRole="employee"><EmployeeMyProjects /></ProtectedRoute>} />
        <Route path="/employee/time-log" element={<ProtectedRoute allowedRole="employee"><EmployeeTimeLog /></ProtectedRoute>} />
        <Route path="/employee/meetings" element={<ProtectedRoute allowedRole="employee"><Meetings /></ProtectedRoute>} />
        <Route path="/employee/messages" element={<ProtectedRoute allowedRole="employee"><Messages /></ProtectedRoute>} />
        <Route path="/employee/my-profile" element={<ProtectedRoute allowedRole="employee"><EmployeeMyProfile /></ProtectedRoute>} />
        <Route path="/employee/profile" element={<ProtectedRoute allowedRole="employee"><EmployeeMyProfile /></ProtectedRoute>} />

        <Route path="/EmployeesAndRoles" element={<ProtectedRoute allowedRole="admin"><AdminEmployeesAndRoles /></ProtectedRoute>} />
        <Route path="/Teams" element={<ProtectedRoute allowedRole="admin"><AdminTeams /></ProtectedRoute>} />
      </Route>
    </Routes>
  )
}

export default AppRoutes
