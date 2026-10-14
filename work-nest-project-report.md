# Assignment Report on WorkNest

## 1. Title
WorkNest: A Role-Based Company Management and Productivity System

## 2. Submitted By
[Your Name]

## 3. Course / Subject
[Course Name / Subject Name]

## 4. Institution
[Your Institution / University Name]

## 5. Date
October 14, 2026

---

## 6. Introduction
This project is a full-stack web application named WorkNest, designed to manage employee operations within a company. It is built as a role-based internal system where different users have different access levels and responsibilities. The application is aimed at helping organizations manage employees, teams, tasks, projects, meetings, attendance, communication, and reporting in one place.

The project is divided into two main parts: frontend and backend. The frontend is developed using React and Vite, while the backend is built using Node.js, Express.js, and MySQL. The entire application uses JWT authentication, role-based access control, and a structured database model to manage company data securely.

The main purpose of this system is to create a digital workspace where an organization can maintain its internal operations efficiently. It reduces manual tracking and improves visibility for administrators, managers, and employees.

---

## 7. Objectives of the Project
The primary objectives of this project are as follows:

- To create a company-based employee management system
- To enable role-based access for admin, manager, and employee users
- To manage teams, departments, and employee assignments
- To handle task creation, tracking, and project progress
- To support attendance and time logging
- To schedule and manage meetings
- To provide internal messaging among company members
- To generate reports and summaries for better decision-making
- To create a secure and scalable application using modern web technologies

---

## 8. Problem Statement
In many organizations, employee and project information are often managed manually using spreadsheets, emails, or disconnected tools. This creates problems like delayed communication, poor task tracking, unknown project progress, confusion in attendance, and lack of centralized reporting.

This project addresses those issues by providing a single platform that centralizes company operations. It allows different stakeholders to maintain and monitor the workflow without depending on scattered systems.

---

## 9. Project Overview
WorkNest is a role-based workplace management system. It allows a company to register itself, create an admin account, and then build an internal organizational structure. Admins can manage employees and their roles, while managers can supervise team tasks and track performance. Employees can access their assigned tasks, update progress, submit work, view projects, and log their work hours.

At the system level, WorkNest combines multiple modules:

- Authentication and authorization
- Employee management
- Team management
- Project management
- Task management
- Time and attendance management
- Meetings management
- Internal messaging system
- Reporting and analytics

---

## 10. System Architecture
The system follows a full-stack architecture with a clear separation between frontend and backend.

### 10.1 Frontend Layer
The frontend is a React application created with Vite. It uses React Router for navigation and Tailwind CSS for building responsive pages. The user interface is modular, with reusable components such as:

- Header
- Sidebar
- Layout wrapper
- Authentication pages
- Role-specific dashboard pages

The frontend fetches data from the backend using Axios. It stores authentication information in local storage and protects pages by checking token validity and role permissions.

### 10.2 Backend Layer
The backend is built using Node.js and Express.js. It exposes REST APIs for every major functionality, including authentication, dashboards, employee management, projects, tasks, meetings, messages, reports, and attendance.

### 10.3 Database Layer
The system uses MySQL as the relational database. It stores data in tables such as:

- `companies`
- `users`
- `teams`
- `projects`
- `tasks`
- `meetings`
- `meeting_attendees`
- `time_logs`
- `messages`
- `password_resets`
- `settings`

Each table is linked to the company so that employees, projects, teams, and reports remain isolated within their organization.

---

## 11. Technology Stack

### 11.1 Frontend Technologies
- React 19
- Vite
- React Router DOM
- Axios
- Tailwind CSS
- Lucide React icons

### 11.2 Backend Technologies
- Node.js
- Express.js
- MySQL (mysql2)
- JWT
- bcryptjs
- multer
- express-validator
- CORS

### 11.3 Why These Technologies?
These technologies are suitable for building a scalable and modern full-stack application. React provides a dynamic frontend experience, while Node.js and Express make backend API development fast and efficient. MySQL allows reliable relational data storage, while JWT ensures secure authentication and authorization.

---

## 12. Roles in the System
The application supports three main roles:

### 12.1 Admin
The admin is the highest-level user and usually represents the company owner or management team. Their responsibilities include:

- Registering the company
- Managing employees
- Assigning roles and positions
- Creating teams
- Tracking all projects
- Monitoring attendance
- Creating and reviewing reports
- Managing company settings and office hours

### 12.2 Manager
The manager supervises a specific team. Their responsibilities include:

- Viewing team members
- Assigning tasks
- Monitoring task progress
- Reviewing employee performance
- Tracking team attendance
- Generating team reports
- Managing meetings and communication

### 12.3 Employee
The employee is a regular user with limited access. Their responsibilities include:

- Viewing assigned tasks
- Updating task progress
- Submitting work tasks
- Viewing company projects
- Tracking personal time logs
- Viewing teammates
- Editing profile information
- Participating in meetings and messaging

---

## 13. Frontend Pages and Functionalities
The frontend contains multiple role-based pages designed for each user type.

### 13.1 Authentication Pages
#### Login Page
The login page allows users to sign in with their email and password. On successful login, the system stores the JWT token and user data in local storage. The system then redirects the user to the appropriate landing page based on their role.

#### Registration Page
The registration page allows a company to register itself. Users provide company details, admin full name, email, and password. Once submitted, the backend creates the company record and admin account.

#### Forgot Password Page
This page allows users to request a password reset. The system generates a reset code, stores its hash, and then validates the code for password update.

### 13.2 Admin Pages
#### Overview Page
The admin overview page shows company metrics such as total employees, tasks, projects, and meetings. This helps management monitor the whole organization at a glance.

#### Employees and Roles Page
In this page, the admin can add new employees, update existing profiles, assign roles, assign team membership, and activate or deactivate accounts.

#### Teams Page
This page manages teams, team leader assignment, and organizational structure. It is useful for dividing work across departments and teams.

#### Projects Page
Admin can create new projects, set due dates, track progress, define project priority, and monitor the overall project lifecycle.

#### Tasks Page
The admin can view all tasks managed by the organization and monitor task status across departments.

#### Time & Attendance Page
This page shows all attendance records in the company to help track employee working hours and schedule adherence.

#### Reports Page
Admin can view company-wide tasks and work records to prepare reports and analyze business performance.

#### Profile and Settings Page
These pages allow the admin to manage their personal information and adjust system settings such as office hours.

### 13.3 Manager Pages
#### Overview Page
The manager sees a dashboard focused on team activity and active workloads.

#### My Team Page
Managers can view all team members under their supervision, which helps with workload distribution and monitoring.

#### Projects Page
This page lists projects associated with the manager's team so the manager can track project progress and responsibilities.

#### Tasks Page
Managers can assign tasks to employees, change task status, and check task delivery progress.

#### Time & Attendance Page
Managers can track their team's time logs and working hours.

#### Reports Page
Managers can review work progress and task status for their team.

### 13.4 Employee Pages
#### Overview Page
Employees see a summary of their assigned tasks and progress status.

#### My Tasks Page
Employees can view all tasks assigned to them and update their current status.

#### My Projects Page
Employees can see company projects relevant to their work.

#### Time Log Page
This page allows employees to clock in and clock out and maintain their attendance records.

#### My Team Page
Employees can see other members of their team and understand the team structure.

#### My Profile Page
Employees can update their name, position, and profile information.

### 13.5 Shared Pages
#### Meetings Page
This module allows users to create, view, edit, and delete meetings. It also supports attendee assignment so participants can be invited to a meeting.

#### Messages Page
This page enables internal messaging between company users. Users can view conversations and send messages to allowed recipients within the same company.

---

## 14. Backend Modules and Functionalities
The backend is organized into controllers and routes, each related to a specific domain.

### 14.1 Authentication Module
The authentication module handles:

- user registration
- login
- password reset request
- password reset confirmation
- current user retrieval
- change password
- token validation

This module ensures secure access to the application.

### 14.2 Admin Controller
The admin controller handles employees, teams, tasks, reports, company settings, and dashboard data. It verifies that actions are performed only within the admin's company scope.

### 14.3 Manager Controller
The manager controller is designed to supervise team members and team workloads. It limits access to users within the manager's team scope so managers cannot access unrelated employees.

### 14.4 Employee Controller
This controller deals with tasks, profiles, projects, messages, and attendance for employees. It allows employees to update their own task progress and submit work assignments.

### 14.5 Project Controller
The project controller manages the creation, deletion, and updating of projects and teams. It restricts these actions based on role.

### 14.6 Meeting Controller
This controller manages meetings and attendee data. It supports creating and updating schedules, invited users, meeting links, and status.

### 14.7 Message Controller
The message controller handles company communication. It validates recipients and ensures only approved users within the same company can exchange messages.

### 14.8 Report Controller
This controller exposes summary and detailed report data based on tasks and company status.

### 14.9 Time Attendance Controller
This module calculates time logs, office hours, duration, and attendance records. It also supports updating and deleting records.

---

## 15. Core Functional Workflow of the Application
The overall operation of the project follows a structured flow:

1. A company registers itself and creates an admin account.
2. The admin adds employees and assigns them roles and teams.
3. Managers are assigned to specific teams.
4. Projects are created under the company.
5. Tasks are assigned to employees by managers or admin.
6. Employees update task progress and submit work.
7. Managers review the submissions and update task status.
8. Employees clock in and out using the time log feature.
9. Meetings are scheduled with attendees.
10. Employees and managers communicate through the internal messaging feature.
11. Admin and managers generate reports based on system data.

This workflow shows how the system operates as a complete company productivity ecosystem.

---

## 16. Database Design and Data Model
The database is designed around the company as the core unit. Every table stores data linked to a `company_id`, therefore each organization works within an isolated data environment.

### 16.1 `companies` Table
Stores company information such as name, industry, and company size.

### 16.2 `users` Table
Stores user-level information, including:

- name
- email
- password hash
- role
- position
- team assignment
- profile image
- activation status

### 16.3 `teams` Table
Stores team information and team leader assignments.

### 16.4 `projects` Table
Stores project metadata such as name, description, progress, due date, priority, and status.

### 16.5 `tasks` Table
Tracks tasks and their lifecycle, including deadline, progress, status, assignee, and submissions.

### 16.6 `meetings` Table
Contains meeting details such as date, time, organizer, status, and meeting link.

### 16.7 `meeting_attendees` Table
Links meetings to invited users.

### 16.8 `time_logs` Table
Stores check-in/out details and computed duration.

### 16.9 `messages` Table
Stores internal communication messages between users.

### 16.10 `password_resets` Table
Stores reset requests and token hashes to support password reset security.

---

## 17. Security Measures in the Project
Security is an essential part of this project. The following safeguards are included:

- JWT authentication for protected APIs
- Role-based access control for admin, manager, and employee routes
- Company-level data isolation using `company_id`
- Password hashing with bcrypt
- Input validation using express-validator
- Session invalidation on unauthorized access
- Failed login attempt tracking and lockout support
- Secure handling of sensitive user information

These measures make the application more reliable and appropriate for practical business use.

---

## 18. API Structure and Functionality
The backend exposes REST APIs using route groups, such as:

- `/api/auth` for authentication
- `/api/admin` for admin functions
- `/api/manager` for manager operations
- `/api/employee` for employee actions
- `/api/projects` for project and team operations
- `/api/meetings` for scheduling and meeting management
- `/api/messages` for internal communication
- `/api/reports` for analytics
- `/api/time-attendance` for attendance tracking

This structure makes the application scalable and easy to expand.

---

## 19. Frontend and Backend Communication
The frontend communicates with the backend through the API service file. This service attaches the JWT token to requests automatically. If the server returns a `401 Unauthorized` response, the frontend clears local storage and redirects the user to the login page.

This keeps the user session secure and ensures unauthorized users cannot continue using the application.

---

## 20. Strengths of the Project
The project has several notable strengths:

- Clear role-based design
- Full-stack architecture with modular structure
- Database-driven company management system
- Good separation of responsibilities between admin, manager, and employee
- Integrated attendance, meeting, message, and project features
- Modern UI with responsive layout
- Real-world functionality similar to workplace management systems

---

## 21. Limitations and Possible Improvements
Although the project is functional and well-structured, it also has room for improvement:

- More advanced analytics and charts can be added
- Real-time notifications can be implemented
- File upload support can be expanded for more document handling
- Better reporting dashboards could be included
- Mobile-first optimization can be improved
- Real-time messaging using WebSockets can be introduced

These improvements can make the system more modern and business-ready.

---

## 22. Conclusion
WorkNest is a comprehensive full-stack project that fulfills the need for an internal company management platform. It brings together several critical business operations such as employee management, team handling, project tracking, task assignment, time tracking, meetings, and communication into a single system.

The project demonstrates the practical application of modern web technologies and software engineering concepts. It follows a structured architecture, role-based permission model, and database-driven workflow, which makes it highly suitable for real business scenarios. Through this project, we can understand how full-stack development can create a useful digital operations system for an organization.

In summary, WorkNest acts as a complete internal workforce management platform that improves productivity, communication, and accountability within a company.

---

## 23. Short AI-Friendly Summary
This is a full-stack company management system called WorkNest, built with React, Vite, Tailwind CSS, Node.js, Express.js, and MySQL. It supports three roles: admin, manager, and employee. Admin can manage teams, employees, projects, attendance, settings, and reports. Managers can supervise their team, assign tasks, track progress, and monitor attendance. Employees can view tasks, update progress, submit work, track work hours, and participate in meetings and messages. The backend uses JWT authentication, role-based authorization, and a MySQL database to store company data. The project represents a realistic internal workforce management system designed to improve productivity and communication in an organization.

---

## 24. References
This project was developed as a custom full-stack application using modern web and backend technologies. It is based on standard practices of:

- React application development
- REST API design
- Relational database modeling
- JWT-based authentication
- Role-based access control
- Full-stack project architecture
