import { createBrowserRouter } from "react-router";
import RootLayout from "./components/layouts/RootLayout";
import LoginPage from "./components/pages/LoginPage";
import DashboardRouter from "./components/pages/DashboardRouter";
import RecruitmentManagement from "./components/pages/RecruitmentManagement";
import ApplicationForm from "./components/pages/ApplicationForm";
import EmployeeRecords from "./components/pages/EmployeeRecords";
import EmployeeProfile from "./components/pages/EmployeeProfile";
import ScheduleManagement from "./components/pages/ScheduleManagement";
import AttendanceMonitoring from "./components/pages/AttendanceMonitoring";
import RequestManagement from "./components/pages/RequestManagement";
import PayrollComputation from "./components/pages/PayrollComputation";
import PerformanceEvaluation from "./components/pages/PerformanceEvaluation";
import Reports from "./components/pages/Reports";
import ApplyForJobPage from "./components/pages/ApplyForJobPage";
import TrackApplicationPage from "./components/pages/TrackApplicationPage";
import UserManagement from "./components/pages/UserManagement";
import EmployeeTimeTracker from "./components/pages/EmployeeTimeTracker";
import EmployeePayslips from "./components/pages/EmployeePayslips";
import MyProfile from "./components/pages/MyProfile";
import EmployeeDTR from "./components/pages/EmployeeDTR";
import LandingPage from "./components/pages/LandingPage";
import JobPostingManagement from "./components/pages/JobPostingManagement";

export const router = createBrowserRouter([
  {
  path: "/",
  element: <LandingPage />,
},
{
  path: "/login",
  element: <LoginPage />,
},
  {
    path: "/apply",
    element: <ApplyForJobPage />,
  },
  {
    path: "/track",
    element: <TrackApplicationPage />,
  },

  {
  path: "/careers",
  element: <LandingPage />,
},
  {
    path: "/dashboard",
    element: <RootLayout />,
    children: [
      // Role-based dashboard home
      { index: true, element: <DashboardRouter /> },
      // HR / Admin
      { path: "recruitment", element: <RecruitmentManagement /> },
      { path: "job-postings", element: <JobPostingManagement /> },
      { path: "recruitment/apply", element: <ApplicationForm /> },
      { path: "users", element: <UserManagement /> },
      { path: "employees", element: <EmployeeRecords /> },
      { path: "employees/:id", element: <EmployeeProfile /> },
      { path: "attendance", element: <AttendanceMonitoring /> },
      { path: "payroll", element: <PayrollComputation /> },
      { path: "reports", element: <Reports /> },
      // Supervisor
      { path: "schedule", element: <ScheduleManagement /> },
      { path: "requests", element: <RequestManagement /> },
      { path: "evaluation", element: <PerformanceEvaluation /> },
      // Employee
      { path: "time", element: <EmployeeTimeTracker /> },
      { path: "dtr", element: <EmployeeDTR /> },
      { path: "payslips", element: <EmployeePayslips /> },
      { path: "profile", element: <MyProfile /> },
    ],
  },
]);