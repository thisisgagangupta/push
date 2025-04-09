import React, { useState, useEffect } from "react";
import axios from "axios";
import "./GetMedicalAdvice.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function extractBulletPoints(text = "") {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

function getSectionText(fullText, heading) {
  const regex = new RegExp(`\\*\\*${heading}\\*\\*([\\s\\S]*?)(?=\\*\\*|$)`, "i");
  const match = fullText.match(regex);
  return match ? match[1].trim() : "";
}

async function fetchPresignedUrl(fileUrl) {
  if (!fileUrl) return "";
  try {
    const response = await axios.get(`${API_BASE_URL}/api/file-preview`, {
      params: { file_url: fileUrl },
    });
    return response.data.presigned_url || fileUrl;
  } catch (error) {
    console.error("Error fetching presigned URL:", error);
    return fileUrl;
  }
}

const GetMedicalAdvice = () => {
  const [patientIdInput, setPatientIdInput] = useState(""); 

  const [patientName, setPatientName] = useState("");
  const [contact, setContact] = useState("");

  const [loadedPatientId, setLoadedPatientId] = useState("");

  const [loadedName, setLoadedName] = useState("");
  const [loadedAge, setLoadedAge] = useState("");
  const [loadedGender, setLoadedGender] = useState("");
  const [loadedContact, setLoadedContact] = useState("");
  const [gptAdvice, setGptAdvice] = useState("");
  const [imageAnalysis, setImageAnalysis] = useState("");
  const [labAnalysis, setLabAnalysis] = useState("");
  const [prescriptionAnalysis, setPrescriptionAnalysis] = useState("");
  const [mostLikelyRaw, setMostLikelyRaw] = useState("");
  const [otherDiagRaw, setOtherDiagRaw] = useState("");
  const [testsRaw, setTestsRaw] = useState("");
  const [treatmentRaw, setTreatmentRaw] = useState("");
  const [prognosis, setPrognosis] = useState("");
  const [caseSummary, setCaseSummary] = useState("");
  const [mostLikelyItems, setMostLikelyItems] = useState([]);
  const [otherDiagList, setOtherDiagList] = useState([]);
  const [testsList, setTestsList] = useState([]);
  const [treatmentList, setTreatmentList] = useState([]);
  const [imagingInsights, setImagingInsights] = useState([]);
  const [labInsights, setLabInsights] = useState([]);
  const [prescriptionInsights, setPrescriptionInsights] = useState([]);
  const [prognosisInsights, setPrognosisInsights] = useState([]);

  // Final selections
  const [finalDiagnosis, setFinalDiagnosis] = useState("");
  const [selectedOtherDiags, setSelectedOtherDiags] = useState([]);
  const [finalTests, setFinalTests] = useState([]);
  const [finalTreatments, setFinalTreatments] = useState([]);

  // Search match states for multiple results
  const [searchMatches, setSearchMatches] = useState([]);
  const [showMatches, setShowMatches] = useState(false);

  // UI states
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingSelections, setSavingSelections] = useState(false);

  // File preview states
  const [labReportUrl, setLabReportUrl] = useState("");
  const [medicalImagingUrl, setMedicalImagingUrl] = useState("");
  const [previousPrescriptionUrl, setPreviousPrescriptionUrl] = useState("");

  const [includeLabReport, setIncludeLabReport] = useState(true);
  const [includeMedicalImaging, setIncludeMedicalImaging] = useState(true);
  const [includePrevPrescription, setIncludePrevPrescription] = useState(true);
  const [serviceSettings, setServiceSettings] = useState({});

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewType, setPreviewType] = useState("pdf");
  const [previewUrl, setPreviewUrl] = useState("");

  // Fetch service settings on component mount
  useEffect(() => {
    fetchServiceSettings();
  }, []);

  const fetchServiceSettings = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/services`);
      const settings = {};
      response.data.forEach(service => {
        settings[service.name.toLowerCase()] = {
          include_in_report: service.include_in_report,
          id: service.id
        };
      });
      setServiceSettings(settings);

      // Set default states based on service settings if available
      if (settings['lab report']) {
        setIncludeLabReport(settings['lab report'].include_in_report);
      }
      if (settings['medical imaging']) {
        setIncludeMedicalImaging(settings['medical imaging'].include_in_report);
      }
      if (settings['previous prescription']) {
        setIncludePrevPrescription(settings['previous prescription'].include_in_report);
      }
    } catch (err) {
      console.error("Error fetching service settings:", err);
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewUrl("");
  };

  // 1) "Get Medical Advice" button
  const handleGetAdvice = async () => {
    setErrorMsg("");
    setLoading(true);
    setShowMatches(false);
    setSearchMatches([]);
    setGptAdvice("");

    // Reset file links
    setLabReportUrl("");
    setMedicalImagingUrl("");
    setPreviousPrescriptionUrl("");

    // Reset loaded patient details
    setLoadedName("");
    setLoadedAge("");
    setLoadedGender("");
    setLoadedContact("");

    try {
      let finalId = patientIdInput.trim();

      // If no ID, search by name/contact
      if (!finalId) {
        if (!patientName && !contact) {
          setErrorMsg("Please enter Patient ID or (Name & Contact) to search.");
          setLoading(false);
          return;
        }
        const params = {};
        if (patientName) params.name = patientName;
        if (contact) params.contact = contact;
        const searchRes = await axios.get(`${API_BASE_URL}/api/search`, { params });
        const { count, records } = searchRes.data;
        if (!count || !records || records.length === 0) {
          setErrorMsg("No matching patient found for those search details.");
          setLoading(false);
          return;
        } else if (records.length === 1) {
          finalId = records[0].id;
          // *** We do NOT reset patientIdInput here; just use finalId internally. ***
        } else {
          setSearchMatches(records);
          setShowMatches(true);
          setLoading(false);
          return;
        }
      } else {
        // An ID is provided. If user also provided name/contact, let's confirm they match the same record.
        if (patientName || contact) {
          const params = { patient_id: finalId };
          if (patientName) params.name = patientName;
          if (contact) params.contact = contact;

          const searchRes = await axios.get(`${API_BASE_URL}/api/search`, { params });
          const { count, records } = searchRes.data;

          if (!count || !records || records.length === 0) {
            setErrorMsg(
              "The details you provided do not match. Please try searching by only name or check ID again."
            );
            setLoading(false);
            return;
          } else if (records.length === 1) {
            finalId = records[0].id;
          } else {
            setSearchMatches(records);
            setShowMatches(true);
            setLoading(false);
            return;
          }
        }
      }

      // --- CHANGE #4: store the final ID in `loadedPatientId` ---
      setLoadedPatientId(String(finalId));

      // Fetch advice and file URLs
      await fetchAdviceForId(finalId);
      await fetchPatientFiles(finalId);
    } catch (err) {
      console.error("Error in handleGetAdvice:", err);
      setErrorMsg("Failed to fetch advice. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  // 2) Call /api/advice
  const fetchAdviceForId = async (pid) => {
    try {
      const resp = await axios.post(`${API_BASE_URL}/api/advice`, {
        patient_id: pid,
        include_medical_imaging: includeMedicalImaging,
        include_lab_report: includeLabReport,
        include_prescription: includePrevPrescription
      });
      const adviceText = resp.data.advice || "";
      parseGptAdvice(adviceText);

      // Clear leftover matches
      setShowMatches(false);
      setSearchMatches([]);
    } catch (err) {
      console.error("fetchAdviceForId error:", err);
      setErrorMsg("Failed to fetch advice for that patient ID.");
    }
  };

  // 3) Parse GPT advice
  const parseGptAdvice = (adviceText) => {
    setGptAdvice(adviceText);

    // Extract each heading
    const imgSec = getSectionText(adviceText, "Medical Image Analysis \\(if any\\)");
    const labSec = getSectionText(adviceText, "Lab Report Analysis \\(if any\\)");
    const presSec = getSectionText(adviceText, "Prescription Analysis \\(if any\\)");
    const diagSec = getSectionText(adviceText, "Most Likely Diagnosis");
    const otherSec = getSectionText(adviceText, "Other Possible Diagnoses");
    const testsSec = getSectionText(adviceText, "Suggested Tests");
    const treatSec = getSectionText(adviceText, "Suggested Treatment Plan");
    const progSec = getSectionText(adviceText, "Prognosis");
    const sumSec = getSectionText(adviceText, "Case Summary");

    // Save raw texts (fallback to "None provided.")
    setImageAnalysis(imgSec || "None provided.");
    setLabAnalysis(labSec || "None provided.");
    setPrescriptionAnalysis(presSec || "None provided.");
    setMostLikelyRaw(diagSec || "None provided.");
    setOtherDiagRaw(otherSec || "None provided.");
    setTestsRaw(testsSec || "None provided.");
    setTreatmentRaw(treatSec || "None provided.");
    setPrognosis(progSec || "None provided.");
    setCaseSummary(sumSec || "None provided.");

    // Extract bullet points
    const diagBullets = extractBulletPoints(diagSec);
    const otherBullets = extractBulletPoints(otherSec);
    const testsBullets = extractBulletPoints(testsSec);
    const treatBullets = extractBulletPoints(treatSec);
    setMostLikelyItems(diagBullets);
    setOtherDiagList(otherBullets);
    setTestsList(testsBullets);
    setTreatmentList(treatBullets);

    const imageBullets = extractBulletPoints(imgSec);
    setImagingInsights(imageBullets);

    const labBullets = extractBulletPoints(labSec);
    setLabInsights(labBullets);

    const prescriptionBullets = extractBulletPoints(presSec);
    setPrescriptionInsights(prescriptionBullets);

    const progBullets = extractBulletPoints(progSec);
    setPrognosisInsights(progBullets);

    // Reset final selections
    setFinalDiagnosis("");
    setSelectedOtherDiags([]);
    setFinalTests([]);
    setFinalTreatments([]);
  };

  // 4) Fetch patient's file URLs & basic info
  const fetchPatientFiles = async (pid) => {
    try {
      const detailResp = await axios.get(`${API_BASE_URL}/api/patient/${pid}/detailed`);
      const row = detailResp.data;
      if (!row) return;

      setLoadedName(row.patient_name || "");
      setLoadedAge(row.age ? String(row.age) : "");
      setLoadedGender(row.gender || "");
      setLoadedContact(row.contact_number || "");

      const { lab_report_url, medical_imaging_url, previous_prescription_url } = row;
      if (lab_report_url) {
        const presignedLab = await fetchPresignedUrl(lab_report_url);
        setLabReportUrl(presignedLab);
      }
      if (medical_imaging_url) {
        const presignedImage = await fetchPresignedUrl(medical_imaging_url);
        setMedicalImagingUrl(presignedImage);
      }
      if (previous_prescription_url) {
        const presignedPresc = await fetchPresignedUrl(previous_prescription_url);
        setPreviousPrescriptionUrl(presignedPresc);
      }
    } catch (err) {
      console.error("Error fetching patient detail or presigned URL:", err);
    }
  };

  // 5) Multiple matches => pick one
  const handlePickMatch = async (pickedId) => {
    if (!pickedId) return;
    setShowMatches(false);
    setSearchMatches([]);
    setErrorMsg("");
    setLoading(true);
    // Notice we do NOT setPatientIdInput here; that's optional if you want to show it.
    // But we do set the loaded ID:
    setLoadedPatientId(String(pickedId));

    try {
      await fetchAdviceForId(pickedId);
      await fetchPatientFiles(pickedId);
    } finally {
      setLoading(false);
    }
  };

  // 6) Save final selections
  const handleSaveSelections = async () => {
    if (!gptAdvice) {
      setErrorMsg("No advice to save yet. Please generate advice first.");
      return;
    }
    setErrorMsg("");
    let chosenDx = finalDiagnosis.trim();
    const otherDiagsStr = selectedOtherDiags.join(", ");
    if (chosenDx && otherDiagsStr) {
      chosenDx += ", " + otherDiagsStr;
    } else if (!chosenDx && otherDiagsStr) {
      chosenDx = otherDiagsStr;
    }
    if (!chosenDx) {
      alert("Please pick a diagnosis: either from 'Most Likely' or 'Other'.");
      return;
    }
    setSavingSelections(true);
    try {
      const finalTestsStr = finalTests.join(", ");
      const finalTreatsStr = finalTreatments.join(", ");
      // --- CHANGE #5: use `loadedPatientId` for saving ---
      let finalId = parseInt(loadedPatientId || "0", 10);
      if (!finalId && searchMatches.length === 1) {
        finalId = searchMatches[0].id;
      }
      if (!finalId) {
        setErrorMsg("Cannot determine patient ID to save final choices.");
        return;
      }
      const payload = {
        patient_id: finalId,
        final_diagnosis: chosenDx,
        final_tests: finalTestsStr,
        final_treatment_plan: finalTreatsStr,
        case_summary: caseSummary,
        included_lab_report: includeLabReport,
        included_medical_imaging: includeMedicalImaging,
        included_prescription: includePrevPrescription
      };
      await axios.post(`${API_BASE_URL}/api/final-choices`, payload);
      alert("Doctor's Final Choices & Case Summary saved successfully!");
    } catch (err) {
      console.error("Error saving final choices:", err);
      setErrorMsg("Failed to save your selections.");
    } finally {
      setSavingSelections(false);
    }
  };

  // Multi-select checkboxes
  const handleOtherDiagCheck = (diag) => {
    setSelectedOtherDiags((prev) =>
      prev.includes(diag) ? prev.filter((d) => d !== diag) : [...prev, diag]
    );
  };

  const handleTestCheck = (test) => {
    if (finalTests.includes(test)) {
      setFinalTests(finalTests.filter((t) => t !== test));
    } else {
      setFinalTests([...finalTests, test]);
    }
  };

  const handleTreatmentCheck = (item) => {
    if (finalTreatments.includes(item)) {
      setFinalTreatments(finalTreatments.filter((t) => t !== item));
    } else {
      setFinalTreatments([...finalTreatments, item]);
    }
  };

  // File preview
  const handleOpenPreview = (url) => {
    if (!url) return;
    const lower = url.toLowerCase();
    setPreviewType(lower.includes(".pdf") ? "pdf" : "image");
    setPreviewUrl(url);
    setPreviewOpen(true);
  };

  return (
    <div className="search-patient-container fade-in">
      <h2 className="search-title">Diagnosis, Prognosis &amp; Treatment</h2>
      {errorMsg && <div className="search-error">{errorMsg}</div>}

      {/* Search Form */}
      <div className="search-form">
        <div className="search-group">
          <label>Patient ID (optional):</label>
          {/* --- CHANGE #6: This input uses `patientIdInput` --- */}
          <input
            type="text"
            value={patientIdInput}
            onChange={(e) => setPatientIdInput(e.target.value)}
            placeholder="Enter ID if known"
          />
        </div>
        <div className="search-group">
          <label>Name (optional):</label>
          <input
            type="text"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            placeholder="e.g. John"
          />
        </div>
        <div className="search-group">
          <label>Contact (optional):</label>
          <input
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="e.g. 1234567890"
          />
        </div>
        <button
          className={`search-btn ${loading ? "loading" : ""}`}
          onClick={handleGetAdvice}
          disabled={loading}
        >
          {loading ? "Loading..." : "Get Medical Advice"}
        </button>
      </div>

      {/* Include in Report Settings */}
      <div className="include-in-report-settings">
        <h4>Include in Analysis:</h4>
        <div className="include-options">
          <div className="checkbox-item">
            <input
              type="checkbox"
              id="includeMedicalImaging"
              checked={includeMedicalImaging}
              onChange={(e) => setIncludeMedicalImaging(e.target.checked)}
            />
            <label htmlFor="includeMedicalImaging">Include Medical Imaging</label>
          </div>
          <div className="checkbox-item">
            <input
              type="checkbox"
              id="includeLabReport"
              checked={includeLabReport}
              onChange={(e) => setIncludeLabReport(e.target.checked)}
            />
            <label htmlFor="includeLabReport">Include Lab Report</label>
          </div>
          <div className="checkbox-item">
            <input
              type="checkbox"
              id="includePrevPrescription"
              checked={includePrevPrescription}
              onChange={(e) => setIncludePrevPrescription(e.target.checked)}
            />
            <label htmlFor="includePrevPrescription">Include Previous Prescription</label>
          </div>
        </div>
      </div>

      {/* Multiple Matches */}
      {showMatches && searchMatches.length > 1 && (
        <div className="results-container">
          <p>Multiple matches found. Please pick one:</p>
          <ul className="patient-list">
            {searchMatches.map((p) => (
              <li key={p.id} className="patient-item">
                <p>
                  <strong>ID:</strong> {p.id}, <strong>Name:</strong> {p.patient_name},{" "}
                  <strong>Age:</strong> {p.age}, <strong>Gender:</strong> {p.gender},{" "}
                  <strong>Contact:</strong> {p.contact_number}
                </p>
                <button onClick={() => handlePickMatch(p.id)}>Choose This Patient</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* If we have loaded details and advice, show them */}
      {gptAdvice && !showMatches && loadedName && (
        <div className="patient-info-block">
          <h4>Patient Details</h4>
          <p>
            {/* --- CHANGE #7: Display the stable `loadedPatientId` here --- */}
            <strong>ID:</strong> {loadedPatientId}
            {loadedName && <> | <strong>Name:</strong> {loadedName}</>}
            {loadedAge && <> | <strong>Age:</strong> {loadedAge} yrs</>}
            {loadedGender && <> | <strong>Gender:</strong> {loadedGender}</>}
            {loadedContact && <> | <strong>Contact:</strong> {loadedContact}</>}
          </p>
        </div>
      )}

      {/* Display GPT Advice and Parsed Sections */}
      {gptAdvice && !showMatches && (
        <div className="results-container advice-sections">
          {/* File Previews */}
          {(labReportUrl || medicalImagingUrl || previousPrescriptionUrl) && (
            <div className="advice-block file-preview-block">
              <h4>Patient Files:</h4>
              {medicalImagingUrl && (
                <p>
                  <strong>Medical Imaging:</strong>{" "}
                  <span className="preview-link" onClick={() => handleOpenPreview(medicalImagingUrl)}>
                    View
                  </span>
                  <span className="include-status">
                    {includeMedicalImaging ? " (Included in Analysis)" : " (Not included in Analysis)"}
                  </span>
                </p>
              )}
              {labReportUrl && (
                <p>
                  <strong>Lab Report:</strong>{" "}
                  <span className="preview-link" onClick={() => handleOpenPreview(labReportUrl)}>
                    View
                  </span>
                  <span className="include-status">
                    {includeLabReport ? " (Included in Analysis)" : " (Not included in Analysis)"}
                  </span>
                </p>
              )}
              {previousPrescriptionUrl && (
                <p>
                  <strong>Previous Prescription:</strong>{" "}
                  <span className="preview-link" onClick={() => handleOpenPreview(previousPrescriptionUrl)}>
                    View
                  </span>
                  <span className="include-status">
                    {includePrevPrescription ? " (Included in Analysis)" : " (Not included in Analysis)"}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Medical Image Analysis */}
          {medicalImagingUrl && includeMedicalImaging && imageAnalysis && imageAnalysis !== "None provided." && (
            <div className="advice-block">
              <h4>Medical Image Analysis</h4>
              {imagingInsights.length > 0 ? (
                <ul style={{ marginTop: "0.5rem", whiteSpace: "pre-wrap" }}>
                  {imagingInsights.map((point, idx) => (
                    <li key={idx}>{point}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ whiteSpace: "pre-wrap" }}>{imageAnalysis}</p>
              )}
            </div>
          )}

          {/* Lab Report Analysis */}
          {labReportUrl && includeLabReport && labAnalysis && labAnalysis !== "None provided." && (
            <div className="advice-block">
              <h4>Lab Report Analysis</h4>
              {labInsights.length > 0 ? (
                <ul style={{ whiteSpace: "pre-wrap" }}>
                  {labInsights.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ whiteSpace: "pre-wrap" }}>{labAnalysis}</p>
              )}
            </div>
          )}

          {/* Prescription Analysis */}
          {previousPrescriptionUrl && includePrevPrescription && prescriptionAnalysis && prescriptionAnalysis !== "None provided." && (
            <div className="advice-block">
              <h4>Prescription Analysis</h4>
              {prescriptionInsights.length > 0 ? (
                <ul style={{ whiteSpace: "pre-wrap" }}>
                  {prescriptionInsights.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ whiteSpace: "pre-wrap" }}>{prescriptionAnalysis}</p>
              )}
            </div>
          )}

          {/* Most Likely Diagnosis */}
          {mostLikelyItems.length > 0 ? (
            <div className="advice-block">
              <h4>Most Likely Diagnosis (choose one)</h4>
              {mostLikelyItems.map((item, idx) => (
                <div key={idx} className="radio-item">
                  <input
                    type="radio"
                    name="mostLikelyDx"
                    id={`likely_${idx}`}
                    value={item}
                    checked={finalDiagnosis === item}
                    onChange={() => setFinalDiagnosis(item)}
                  />
                  <label htmlFor={`likely_${idx}`}>{item}</label>
                </div>
              ))}
            </div>
          ) : (
            <div className="advice-block">
              <h4>Most Likely Diagnosis</h4>
              <p style={{ whiteSpace: "pre-wrap" }}>{mostLikelyRaw}</p>
            </div>
          )}

          {/* Other Possible Diagnoses */}
          {otherDiagList.length > 0 ? (
            <div className="advice-block">
              <h4>Other Possible Diagnoses (select multiple if needed)</h4>
              {otherDiagList.map((dx, idx) => (
                <div key={idx} className="checkbox-item">
                  <input
                    type="checkbox"
                    id={`other_${idx}`}
                    value={dx}
                    checked={selectedOtherDiags.includes(dx)}
                    onChange={() => handleOtherDiagCheck(dx)}
                  />
                  <label htmlFor={`other_${idx}`}>{dx}</label>
                </div>
              ))}
            </div>
          ) : (
            <div className="advice-block">
              <h4>Other Possible Diagnoses</h4>
              <p style={{ whiteSpace: "pre-wrap" }}>{otherDiagRaw}</p>
            </div>
          )}

          {/* Suggested Tests */}
          {testsList.length > 0 ? (
            <div className="advice-block">
              <h4>Suggested Tests (check all that apply)</h4>
              {testsList.map((test, idx) => (
                <div key={idx} className="checkbox-item">
                  <input
                    type="checkbox"
                    id={`test_${idx}`}
                    checked={finalTests.includes(test)}
                    onChange={() => handleTestCheck(test)}
                  />
                  <label htmlFor={`test_${idx}`}>{test}</label>
                </div>
              ))}
            </div>
          ) : (
            <div className="advice-block">
              <h4>Suggested Tests</h4>
              <p style={{ whiteSpace: "pre-wrap" }}>{testsRaw}</p>
            </div>
          )}

          {/* Suggested Treatment Plan */}
          {treatmentList.length > 0 ? (
            <div className="advice-block">
              <h4>Suggested Treatment Plan (check all that apply)</h4>
              {treatmentList.map((item, idx) => (
                <div key={idx} className="checkbox-item">
                  <input
                    type="checkbox"
                    id={`treat_${idx}`}
                    checked={finalTreatments.includes(item)}
                    onChange={() => handleTreatmentCheck(item)}
                  />
                  <label htmlFor={`treat_${idx}`}>{item}</label>
                </div>
              ))}
            </div>
          ) : (
            <div className="advice-block">
              <h4>Suggested Treatment Plan</h4>
              <p style={{ whiteSpace: "pre-wrap" }}>{treatmentRaw}</p>
            </div>
          )}

          {/* Prognosis */}
          {prognosis && prognosis.trim().toLowerCase() !== "none provided." && (
            <div className="advice-block">
              <h4>Prognosis</h4>
              {prognosisInsights.length > 0 ? (
                <ul style={{ whiteSpace: "pre-wrap" }}>
                  {prognosisInsights.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ whiteSpace: "pre-wrap" }}>{prognosis}</p>
              )}
            </div>
          )}

          {/* Case Summary */}
          {caseSummary && caseSummary.trim().toLowerCase() !== "none provided." && (
            <div className="advice-block summary-block">
              <h4>Case Summary</h4>
              <p style={{ whiteSpace: "pre-wrap" }}>{caseSummary}</p>
            </div>
          )}

          <button
            className={`save-btn ${savingSelections ? "loading" : ""}`}
            onClick={handleSaveSelections}
            disabled={savingSelections}
          >
            {savingSelections ? "Saving..." : "Save Selections"}
          </button>
        </div>
      )}

      {/* File Preview Modal */}
      {previewOpen && (
        <div className="modal-overlay" onClick={closePreview}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={closePreview}>
              &times;
            </button>
            {previewType === "pdf" ? (
              <iframe
                src={previewUrl}
                title="File Preview"
                width="100%"
                height="600px"
                frameBorder="0"
              />
            ) : (
              <img
                src={previewUrl}
                alt="File Preview"
                style={{ maxWidth: "100%", maxHeight: "80vh" }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GetMedicalAdvice;
