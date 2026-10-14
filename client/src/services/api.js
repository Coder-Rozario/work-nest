import axios from 'axios';
import { API_ROOT_URL } from '../config/env';

const API_BASE = API_ROOT_URL;

const api = axios.create({
  baseURL: API_BASE.replace(/\/+$/, ''),
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('worknest_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (body && typeof body === 'object' && body.success !== undefined && body.data !== undefined) {
      return body.data;
    }
    return body;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('worknest_token');
      localStorage.removeItem('worknest_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  changePassword: (data) => api.put('/auth/change-password', data),
};

export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getTasks: () => api.get('/admin/tasks'),
  getEmployees: () => api.get('/admin/employees'),
  addEmployee: (data) => api.post('/admin/employees', data),
  updateEmployee: (id, data) => api.put(`/admin/employees/${id}`, data),
  deleteEmployee: (id) => api.delete(`/admin/employees/${id}`),
  getTeams: () => api.get('/admin/teams'),
  getProjects: () => api.get('/admin/projects'),
  getReports: () => api.get('/admin/reports'),
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (data) => api.put('/admin/settings', data),
};

export const managerAPI = {
  getDashboard: () => api.get('/manager/dashboard'),
  getTeam: () => api.get('/manager/team'),
  getTeamMembers: () => api.get('/manager/team-members'),
  getTeamTasks: () => api.get('/manager/tasks'),
  createTask: (data) => api.post('/manager/tasks', data),
  updateTaskStatus: (id, status) => api.put(`/manager/tasks/${id}/status`, { status }),
  getReports: () => api.get('/manager/reports'),
  getTimeLog: () => api.get('/manager/time-log'),
};

export const employeeAPI = {
  getDashboard: () => api.get('/employee/dashboard'),
  getTasks: () => api.get('/employee/tasks'),
  updateTaskProgress: (id, data) => api.put(`/employee/tasks/${id}/progress`, data),
  submitTask: (id, data, isForm = false) => {
    if (isForm) {
      return api.put(`/employee/tasks/${id}/submit`, data, { headers: { 'Content-Type': 'multipart/form-data' } })
    }
    return api.put(`/employee/tasks/${id}/submit`, data)
  },
  // employee projects are served by the common projects endpoint
  getProjects: () => api.get('/projects'),
  getTeamMembers: () => api.get('/employee/team-members'),
  getTimeLog: () => api.get('/employee/time-log'),
  getProfile: () => api.get('/employee/profile'),
  updateProfile: (data) => api.put('/employee/profile', data),
};

export const projectAPI = {
  getProjects: () => api.get('/projects'),
  getProject: (id) => api.get(`/projects/${id}`),
  createProject: (data) => api.post('/projects', data),
  updateProject: (id, data) => api.put(`/projects/${id}`, data),
  deleteProject: (id) => api.delete(`/projects/${id}`),
  getTeams: () => api.get('/projects/teams'),
  createTeam: (data) => api.post('/projects/teams', data),
  updateTeam: (id, data) => api.put(`/projects/teams/${id}`, data),
  deleteTeam: (id) => api.delete(`/projects/teams/${id}`),
};

export const taskAPI = {
  getTasks: () => api.get('/manager/tasks'),
  createTask: (data) => api.post('/manager/tasks', data),
  updateTaskStatus: (id, status) => api.put(`/manager/tasks/${id}/status`, { status }),
  deleteTask: (id) => api.delete(`/tasks/${id}`),
};

export const reportAPI = {
  getReports: () => api.get('/reports'),
  getTaskSummary: () => api.get('/reports/summary'),
};

export const timeAttendanceAPI = {
  getRecords: () => api.get('/time-attendance'),
  addRecord: (data) => api.post('/time-attendance', data),
  updateRecord: (id, data) => api.put(`/time-attendance/${id}`, data),
  deleteRecord: (id) => api.delete(`/time-attendance/${id}`),
};

export const messageAPI = {
  getConversations: () => api.get('/messages/conversations'),
  getMessages: (userId) => api.get(`/messages/${userId}`),
  sendMessage: (data) => api.post('/messages/send', data),
};

export const meetingAPI = {
  getMeetings: () => api.get('/meetings'),
  getMeetingOptions: () => api.get('/meetings/options'),
  getMeeting: (id) => api.get(`/meetings/${id}`),
  createMeeting: (data) => api.post('/meetings', data),
  updateMeeting: (id, data) => api.put(`/meetings/${id}`, data),
  deleteMeeting: (id) => api.delete(`/meetings/${id}`),
};

export default api;
