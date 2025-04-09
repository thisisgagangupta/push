import React, { useState } from "react";
import { Link } from "react-router-dom";
import logo from '../assets/medmitra_logo1.png';
import './Service.css';

import SearchPatients from './SearchPatients';
import GetMedicalAdvice from './GetMedicalAdvice';
import SavePatientInfo from './SavePatientInfo';
import PrescriptionWriting from './PrescriptionWriting';

const Service = () => {
  const [activeTab, setActiveTab] = useState("search");

  return (
    <div className="service-container">
      <header className="header">
        <img src={logo} alt="Company Logo" className="logo" />
        <nav>
          <Link to="/appointments" className="appointments-nav-link">
            View Appointments
          </Link>
        </nav>
      </header>

      {/* Tab Navigation */}
      <div className="tabs">
        <button
          onClick={() => setActiveTab("save")}
          className={`tab-btn ${activeTab === "save" ? "active" : ""}`}
        >
          Patient Information
        </button>
        <button
          onClick={() => setActiveTab("advice")}
          className={`tab-btn ${activeTab === "advice" ? "active" : ""}`}
        >
          Diagnosis, Prognosis & Treatment
        </button>
        <button
          onClick={() => setActiveTab("search")}
          className={`tab-btn ${activeTab === "search" ? "active" : ""}`}
        >
          Search Patient Records
        </button>
        <button
          onClick={() => setActiveTab("prescription")}
          className={`tab-btn ${activeTab === "prescription" ? "active" : ""}`}
        >
          Prescription Writing
        </button>
      </div>

      <div className="tab-content">
        {activeTab === "save"         && <SavePatientInfo />}
        {activeTab === "advice"       && <GetMedicalAdvice />}
        {activeTab === "search"       && <SearchPatients />}
        {activeTab === "prescription" && <PrescriptionWriting />}
      </div>
    </div>
  );
};

export default Service;
