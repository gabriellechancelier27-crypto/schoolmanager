import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, ROLES, useAuth } from "./auth";
import Layout from "./components/layout";
import { Spinner } from "./components/ui";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Schools from "./pages/Schools";
import Students from "./pages/Students";
import Teachers from "./pages/Teachers";
import ParentsPage from "./pages/ParentsPage";
import SubjectsPage from "./pages/SubjectsPage";
import ClassRooms from "./pages/ClassRooms";
import Enrollments from "./pages/Enrollments";
import SchoolYearPage from "./pages/SchoolYearPage";
import Grades from "./pages/Grades";
import GradesHistory from "./pages/GradesHistory";
import ReportCards from "./pages/ReportCards";
import Attendance from "./pages/Attendance";
import Finance from "./pages/Finance";
import Communication from "./pages/Communication";
import Users from "./pages/Users";
import Profile from "./pages/Profile";

function Guard({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-center"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && user.role !== "SUPER_ADMIN" && !roles.includes(user.role))
    return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Guard><Layout /></Guard>}>
            <Route index element={<Dashboard />} />
            <Route path="etablissements" element={<Guard roles={["SUPER_ADMIN"]}><Schools /></Guard>} />
            <Route path="eleves" element={<Guard roles={[...ROLES.STAFF, "PARENT"]}><Students /></Guard>} />
            <Route path="parents" element={<Guard roles={ROLES.MANAGERS}><ParentsPage /></Guard>} />
            <Route path="enseignants" element={<Guard roles={[...ROLES.MANAGERS, "TEACHER"]}><Teachers /></Guard>} />
            <Route path="classes" element={<Guard roles={ROLES.STAFF}><ClassRooms /></Guard>} />
            <Route path="inscriptions" element={<Guard roles={ROLES.MANAGERS}><Enrollments /></Guard>} />
            <Route path="matieres" element={<Guard roles={ROLES.STAFF}><SubjectsPage /></Guard>} />
            <Route path="annee" element={<Guard roles={ROLES.MANAGERS}><SchoolYearPage /></Guard>} />
            <Route path="comptes" element={<Guard roles={["SCHOOL_ADMIN"]}><Users /></Guard>} />
            <Route path="notes" element={<Guard roles={ROLES.GRADES}><Grades /></Guard>} />
            <Route path="notes/historique" element={<Guard roles={ROLES.GRADES}><GradesHistory /></Guard>} />
            <Route path="bulletins" element={<ReportCards />} />
            <Route path="presences" element={<Attendance />} />
            <Route path="finance" element={<Guard roles={[...ROLES.FINANCE, "PARENT"]}><Finance /></Guard>} />
            <Route path="communication" element={<Communication />} />
            <Route path="profil" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}