import { useEffect } from "react";
import { BrowserRouter as Router, Route, Link, Routes } from "react-router-dom";
import LoginPage from "./components/LoginPage";
import SignUpPage from "./components/SignupPage";
import ForgotPasswordPage from "./components/ForgotPasswordPage";
import ResetPasswordPage from "./components/ResetPasswordPage";
import Input from "./components/Input";
import Service from "./components/Service";
import SavePatientInfo from "./components/SavePatientInfo";
import GetMedicalAdvice from "./components/GetMedicalAdvice";
import SearchPatients from "./components/SearchPatients";
import PrescriptionWriting from "./components/PrescriptionWriting";
import EmailVerificationPage from "./components/EmailVerificationPage";
import NotFoundPage from "./components/NotFoundPage";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import "./App.css";
import logo from "./assets/medmitra_logo1.png";
import ServicesPage from "./components/ServicesPage.jsx";
import { useAuthStore } from "./store/authStore.js";
import AppointmentsPage from "./components/AppointmentsPage";
import ReportsPage from "./components/ReportsPage";
import PharmacyPage from "./components/PharmacyPage.jsx";
function LandingPage() {
  return (
    <div>
      {/* Landing Page Section */}
      <div className="landing-page">
        {/* Logo Image */}
        <img src={logo} alt="Medmitra AI Logo" className="logo" />

        <h1>Welcome to Medmitra AI</h1>
        <p>
          AI-powered healthcare platform to help doctors with diagnosis,
          prognosis, treatment options and manage patients.
        </p>

        <div className="buttons">
          <Link to="/login">
            <button className="btn">Login</button>
          </Link>
          <Link to="/signup">
            <button className="btn">Sign Up</button>
          </Link>
        </div>
      </div>

      {/* Features Section (Separate Div) */}
      <div className="features-section">
        <h2>Our Features</h2>
        <div className="feature-item">
          <h3>Diagnosis</h3>
          <p>
            Accurate AI-powered diagnosis assistance based on patient data and
            medical reports.
          </p>
        </div>
        <div className="feature-item">
          <h3>Prognosis</h3>
          <p>
            Predictive insights on patient outcomes, helping doctors with
            treatment planning.
          </p>
        </div>
        <div className="feature-item">
          <h3>Treatment</h3>
          <p>
            Personalized treatment options based on the latest research and best
            practices.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer">
        <p>
          &copy; 2024 MedMitra AI. All rights reserved. | Made with ❤️ by
          Medmitra AI
        </p>
        <div className="social-icons">
          <a
            href="https://www.linkedin.com/company/medmitra-ai/"
            className="icon"
            target="_blank"
            rel="noopener noreferrer"
          >
            {" "}
            <i className="fa-brands fa-linkedin"></i>
          </a>
        </div>
      </footer>
    </div>
  );
}

function App() {

  const { checkAuth } = useAuthStore();
    
      // 3) On the very first render, check if the user is still authenticated (session/cookie)
    useEffect(() => {
      checkAuth();
    }, [checkAuth]);

  return (
    <Router>
      <Routes>
        {/* Landing Page Route */}
        <Route path="/" element={<LandingPage />} />
        {/* Login Page Route */}
        <Route path="/login" element={<LoginPage />} />
        {/* Sign Up Page Route */}
        <Route path="/signup" element={<SignUpPage />} />
        {/* Forgot Password Page Route */}
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        {/* Reset Password Page Route */}
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        {/* Input for Reset Password Page Route */}
        <Route path="/input" element={<Input />} />
        {/* Service Page Route */}
        <Route path="/home" element={<Service />} />
        {/* <Route
          path="/home"
          element={
            <ProtectedRoute>
              {" "}
              <Service />{" "}
            </ProtectedRoute>
          }
        /> */}
        {/* Patient Info Page Route */}
        <Route path="/patient-info" element={<SavePatientInfo />} />
        {/* Get Medical Advice Page Route */}
        <Route path="/medical-advice" element={<GetMedicalAdvice />} />
        {/* Search Patient Page Route */}
        <Route path="/search-patient" element={<SearchPatients />} />
        {/* Prescription Writing Page Route */}
        <Route path="/prescription-writing" element={<PrescriptionWriting />} />
        {/* Email Verification Page Route */}
        <Route path="/verify-email" element={<EmailVerificationPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/appointments" element={<AppointmentsPage />} />
        <Route path="/report" element={<ReportsPage />} />
        <Route path="/pharmacy/*" element={<PharmacyPage />} />

        {/* Catch-all for unmatched URLs */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}

export default App;