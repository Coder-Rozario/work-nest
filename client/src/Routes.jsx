import { Routes, Route } from "react-router-dom";

import NotFound from "./pages/NotFound";
import Login from "./Pages/Login";

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes */}
  
      <Route path="/login" element={<Login />} />

      {/* 404 Route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;