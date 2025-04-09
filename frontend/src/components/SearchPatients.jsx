import React, { useState, useEffect } from "react";
import axios from "axios";
import Select from "react-select";
import CreatableSelect from "react-select/creatable";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  complaintOptionsByDepartment,
  pastHistorySuggestions,
  personalHistorySuggestions,
  familyHistorySuggestions,
  allergySuggestions,
  medicationHistorySuggestions,
  surgicalHistorySuggestions,
  cityOptions,
} from "./constants";

import "./SearchPatients.css";
import BillingModal from "./BillingModal";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const prefixFilterOption = (option, inputValue) => {
  if (option.data && option.data.__isNew__) {
    return true;
  }
  return option.label.toLowerCase().startsWith(inputValue.toLowerCase());
};

const fetchPresignedUrl = async (fileUrl) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/file-preview`, {
      params: { file_url: fileUrl },
    });
    return response.data.presigned_url;
  } catch (error) {
    console.error("Error fetching presigned URL for", fileUrl, error);
    return fileUrl; // fallback
  }
};

const fetchVersionComplaints = async (versionId) => {
  try {
    const resp = await axios.get(
      `${API_BASE_URL}/api/version/${versionId}/complaints`
    );
    return resp.data.complaints || [];
  } catch (error) {
    console.error(`Error fetching complaints for version ${versionId}:`, error);
    return [];
  }
};

// Convert a comma-separated string to a CreatableSelect array
function parseMultiSelectFromString(strVal = "") {
  const items = strVal
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.map((val) => ({ value: val, label: val }));
}

// Convert a CreatableSelect array back to a comma-separated string
function buildStringFromMultiSelect(arr = []) {
  return arr.map((o) => o.value).join(", ");
}

// Helper for splitting a single string of complaints into selected + "Other"
function parseChiefComplaints(
  chiefComplaintString = "",
  departmentOptions = []
) {
  if (!chiefComplaintString) return { selected: [], otherText: "" };

  const splitted = chiefComplaintString
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const knownValues = new Set(departmentOptions.map((o) => o.value));
  const selected = [];
  const otherItems = [];

  splitted.forEach((item) => {
    if (knownValues.has(item)) {
      const found = departmentOptions.find((o) => o.value === item);
      if (found) selected.push(found);
    } else {
      otherItems.push(item);
    }
  });

  if (otherItems.length > 0) {
    // If we have unrecognized items, we add "Other" and store them in 'otherText'
    selected.push({ value: "Other", label: "Other" });
  }

  return { selected, otherText: otherItems.join(", ") };
}

function buildComplaintString(selectedOptions, otherText) {
  if (!selectedOptions || selectedOptions.length === 0) return "";
  const normalItems = selectedOptions
    .filter((opt) => opt.value !== "Other")
    .map((opt) => opt.value);

  if (
    selectedOptions.some((opt) => opt.value === "Other") &&
    otherText.trim()
  ) {
    normalItems.push(otherText.trim());
  }
  return normalItems.join(", ");
}

const getRelevanceScore = (patientName = "", query = "") => {
  const nameLower = (patientName || "").toLowerCase();
  const queryLower = (query || "").toLowerCase();

  if (!queryLower) return 0;
  if (nameLower === queryLower) {
    return 3; // exact match
  } else if (nameLower.startsWith(queryLower)) {
    return 2; // starts with
  } else if (nameLower.includes(queryLower)) {
    return 1; // partial
  }
  return 0;
};

const sortByRelevance = (records = [], query = "") => {
  if (!query) return records;
  return [...records].sort((a, b) => {
    const scoreB = getRelevanceScore(b.patient_name, query);
    const scoreA = getRelevanceScore(a.patient_name, query);
    return scoreB - scoreA;
  });
};

// [CHANGED] Remove or comment out filterSameDayRedundantVersions usage so we see ALL versions
/*
function filterSameDayRedundantVersions(versions) {
  const groupedByDate = {};
  versions.forEach((v) => {
    const dateKey = new Date(v.version_timestamp).toISOString().split("T")[0];
    if (!groupedByDate[dateKey]) {
      groupedByDate[dateKey] = [];
    }
    groupedByDate[dateKey].push(v);
  });

  let result = [];
  Object.keys(groupedByDate).forEach((dayKey) => {
    const dayVersions = groupedByDate[dayKey].sort(
      (a, b) => new Date(b.version_timestamp) - new Date(a.version_timestamp)
    );
    const advisedVersions = dayVersions.filter(
      (v) => v.medical_advice && v.medical_advice.trim() !== ""
    );
    if (advisedVersions.length > 0) {
      result.push(advisedVersions[0]);
    } else {
      result.push(dayVersions[0]);
    }
  });

  return result.sort(
    (a, b) => new Date(b.version_timestamp) - new Date(a.version_timestamp)
  );
}
*/
// [END CHANGED]

function getSectionText(fullText, heading) {
  const regex = new RegExp(`\\*\\*${heading}\\*\\*([^*]+)(?=\\*\\*|$)`, "i");
  const match = fullText.match(regex);
  return match ? match[1].trim() : "";
}

function removeCaseSummaryFromAdvice(advice = "") {
  const caseSummaryRegex = /\*\*Case Summary\*\*([\s\S]*?)(?=\*\*|$)/i;
  return advice.replace(caseSummaryRegex, "");
}

function VersionDetail({
  patient,
  version,
  adviceOpen,
  toggleAdvice,
  handleGetAdviceForVersion,
  openPreview,
  isAdviceLoading,
}) {
  const [labReportUrl, setLabReportUrl] = useState("");
  const [medicalImgUrl, setMedicalImgUrl] = useState("");
  const [prescriptionUrl, setPrescriptionUrl] = useState("");

  const [showAdditional, setShowAdditional] = useState(false);

  useEffect(() => {
    if (version.lab_report_url) {
      fetchPresignedUrl(version.lab_report_url).then((url) =>
        setLabReportUrl(url)
      );
    }
    if (version.medical_imaging_url) {
      fetchPresignedUrl(version.medical_imaging_url).then((url) =>
        setMedicalImgUrl(url)
      );
    }
    if (version.previous_prescription_url) {
      fetchPresignedUrl(version.previous_prescription_url).then((url) =>
        setPrescriptionUrl(url)
      );
    }
  }, [version]);

  const prescriptionType =
    version.previous_prescription_url &&
    version.previous_prescription_url.toLowerCase().endsWith(".pdf")
      ? "pdf"
      : "image";

  // Extract the "Case Summary" if present in medical_advice
  const briefCaseSummary = version.medical_advice
    ? getSectionText(version.medical_advice, "Case Summary")
    : version.case_summary;

  const vitalsArr = [];
  if (version.bp?.trim()) vitalsArr.push(`BP=${version.bp}`);
  if (version.pulse?.trim()) vitalsArr.push(`Pulse=${version.pulse}`);
  if (version.height?.trim()) vitalsArr.push(`Height=${version.height} cm`);
  if (version.weight?.trim()) vitalsArr.push(`Weight=${version.weight} kg`);
  if (version.temperature?.trim())
    vitalsArr.push(`Temp=${version.temperature} °C`);
  if (version.bmi?.trim()) vitalsArr.push(`BMI=${version.bmi}`);
  if (version.spo2?.trim()) vitalsArr.push(`SpO2=${version.spo2}%`);
  const vitalsLine = vitalsArr.join(" | ");

  const extraFields = [
    {
      key: "preferred_language",
      label: "Preferred Language",
      value: version.preferred_language,
    },
    { key: "email", label: "Email", value: version.email },
    { key: "address", label: "Address", value: version.address },
    { key: "city", label: "City", value: version.city },
    { key: "pin", label: "Pin/Area", value: version.pin },
    { key: "referred_by", label: "Referred By", value: version.referred_by },
    { key: "channel", label: "Channel", value: version.channel },
  ].filter((f) => f.value && f.value.trim() !== "");

  const hasChiefComplaints =
    (version.complaints && version.complaints.length > 0) ||
    (version.chief_complaint && version.chief_complaint.trim() !== "");
  const hasHPI = version.history_of_presenting_illness?.trim() !== "";
  const hasVitals = vitalsLine !== "";
  const hasAnyPatientHistory =
    version.past_history?.trim() !== "" ||
    version.personal_history?.trim() !== "" ||
    version.family_history?.trim() !== "" ||
    version.obg_history?.trim() !== "";
  const hasAllergiesMedSurg =
    version.allergies?.trim() !== "" ||
    version.medication_history?.trim() !== "" ||
    version.surgical_history?.trim() !== "";
  const hasBloodGroup = version.blood_group?.trim() !== "";
  const hasCaseSummary =
    briefCaseSummary?.trim() !== "" && briefCaseSummary !== "(None)";
  const hasAnyFiles = labReportUrl || medicalImgUrl || prescriptionUrl;
  const hasAdvice =
    version.medical_advice && version.medical_advice.trim() !== "";
  const hasFinal =
    version.final_diagnosis?.trim() !== "" ||
    version.final_tests?.trim() !== "" ||
    version.final_treatment_plan?.trim() !== "";

  return (
    <div className="version-detail-box">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <p>
          <strong>Timestamp (IST):</strong>{" "}
          {new Date(version.version_timestamp).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          })}
        </p>
        {extraFields.length > 0 && (
          <button
            className="advice-toggle-btn"
            onClick={() => setShowAdditional(true)}
          >
            Show Additional Info
          </button>
        )}
      </div>

      {showAdditional && (
        <div className="modal-overlay" onClick={() => setShowAdditional(false)}>
          <div
            className="modal-content small-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close-modal"
              onClick={() => setShowAdditional(false)}
            >
              &times;
            </button>
            <h4>Additional Info</h4>
            {extraFields.map((field) => (
              <p key={field.key}>
                <strong>{field.label}:</strong> {field.value}
              </p>
            ))}
          </div>
        </div>
      )}

      <hr />

      {hasChiefComplaints && (
        <>
          <h4>Chief Complaints</h4>
          {version.complaints && version.complaints.length > 0 ? (
            <ul>
              {version.complaints
                .filter((c) => c.complaint && c.complaint.trim() !== "")
                .map((c, idx) => (
                  <li key={idx}>
                    <em>{c.complaint}</em>
                    {c.frequency && ` | Frequency: ${c.frequency}`}
                    {c.severity && ` | Severity: ${c.severity}`}
                    {c.duration && ` | Duration: ${c.duration}`}
                  </li>
                ))}
            </ul>
          ) : (
            <p>{version.chief_complaint}</p>
          )}
          <hr />
        </>
      )}

      {hasHPI && (
        <>
          <h4>History of Presenting Illness</h4>
          <p>{version.history_of_presenting_illness}</p>
          <hr />
        </>
      )}

      {hasVitals && (
        <>
          <h4>Vitals</h4>
          <p>{vitalsLine}</p>
          <hr />
        </>
      )}

      {hasAnyPatientHistory && (
        <>
          <h4>Patient History</h4>
          {version.past_history?.trim() && (
            <p>
              <strong>Past History:</strong> {version.past_history}
            </p>
          )}
          {version.personal_history?.trim() && (
            <p>
              <strong>Personal History:</strong> {version.personal_history}
            </p>
          )}
          {version.family_history?.trim() && (
            <p>
              <strong>Family History:</strong> {version.family_history}
            </p>
          )}
          {version.obg_history?.trim() && (
            <p>
              <strong>OBG History:</strong> {version.obg_history}
            </p>
          )}
          <hr />
        </>
      )}

      {hasAllergiesMedSurg && (
        <>
          <h4>Allergies / Medication / Surgical</h4>
          {version.allergies?.trim() && (
            <p>
              <strong>Allergies:</strong> {version.allergies}
            </p>
          )}
          {version.medication_history?.trim() && (
            <p>
              <strong>Medication History:</strong> {version.medication_history}
            </p>
          )}
          {version.surgical_history?.trim() && (
            <p>
              <strong>Surgical History:</strong> {version.surgical_history}
            </p>
          )}
          <hr />
        </>
      )}

      {hasBloodGroup && (
        <>
          <h4>Blood Group</h4>
          <p>{version.blood_group}</p>
          <hr />
        </>
      )}

      {hasCaseSummary && (
        <>
          <h4>Case Summary</h4>
          <p>{briefCaseSummary}</p>
          <hr />
        </>
      )}

      {hasAnyFiles && (
        <>
          {labReportUrl && (
            <p>
              <strong>Lab Report:</strong>{" "}
              <span
                className="preview-link"
                onClick={() => openPreview(labReportUrl, "pdf")}
              >
                View Lab PDF
              </span>
            </p>
          )}
          {medicalImgUrl && (
            <p>
              <strong>Medical Image:</strong>{" "}
              <span
                className="preview-link"
                onClick={() => openPreview(medicalImgUrl, "image")}
              >
                View Image
              </span>
            </p>
          )}
          {prescriptionUrl && (
            <p>
              <strong>Previous Prescription:</strong>{" "}
              <span
                className="preview-link"
                onClick={() => openPreview(prescriptionUrl, prescriptionType)}
              >
                View Prescription
              </span>
            </p>
          )}
          <hr />
        </>
      )}

      {hasAdvice || isAdviceLoading ? (
        <>
          <h4>Medical Advice</h4>
          {hasAdvice ? (
            !adviceOpen ? (
              <button
                className="advice-toggle-btn"
                onClick={() => toggleAdvice(version.id)}
              >
                See Full Advice
              </button>
            ) : (
              <>
                <button
                  className="advice-toggle-btn"
                  onClick={() => toggleAdvice(version.id)}
                >
                  Hide Advice
                </button>
                <div className="medical-advice-box">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {removeCaseSummaryFromAdvice(version.medical_advice)}
                  </ReactMarkdown>
                </div>
              </>
            )
          ) : (
            <button className="advice-toggle-btn loading" disabled>
              Loading...
            </button>
          )}
          <hr />
        </>
      ) : (
        <>
          <button
            className="advice-toggle-btn"
            onClick={() => handleGetAdviceForVersion(patient, version.id)}
          >
            Get Medical Advice
          </button>
          <hr />
        </>
      )}

      {hasFinal && (
        <>
          <h4>Final Choices</h4>
          {version.final_diagnosis?.trim() && (
            <p>
              <strong>Diagnosis:</strong> {version.final_diagnosis}
            </p>
          )}
          {version.final_tests?.trim() && (
            <p>
              <strong>Tests:</strong> {version.final_tests}
            </p>
          )}
          {version.final_treatment_plan?.trim() && (
            <p>
              <strong>Treatment Plan:</strong> {version.final_treatment_plan}
            </p>
          )}
        </>
      )}
    </div>
  );
}

const SearchPatients = () => {
  const [patientId, setPatientId] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [contact, setContact] = useState("");

  const [searchResults, setSearchResults] = useState([]);
  const [count, setCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const [expansions, setExpansions] = useState({});

  const [preview, setPreview] = useState({ open: false, url: "", type: "" });

  const openPreview = (url, type) => {
    setPreview({ open: true, url, type });
  };

  const closePreview = () => {
    setPreview({ open: false, url: "", type: "" });
  };

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      setErrorMsg("");
      setSearchResults([]);
      setCount(0);

      const { data } = await axios.get(`${API_BASE_URL}/api/search`, {
        params: {
          patient_id: patientId.trim() || undefined,
          name: name.trim() || undefined,
          age: age !== "" ? age : undefined,
          contact: contact.trim() || undefined,
        },
      });

      if (!data || !Array.isArray(data.records)) {
        console.warn("Unexpected response shape:", data);
        setErrorMsg("Invalid response from server. Check logs.");
        return;
      }

      const sorted = sortByRelevance(data.records, name);
      setCount(data.count || 0);
      setSearchResults(sorted);
      setExpansions({});
    } catch (err) {
      console.error("Search error:", err);
      setErrorMsg("Failed to search patient records. See console for details.");
      setSearchResults([]);
      setCount(0);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleViewVersions = async (patient) => {
    if (!patient || !("id" in patient)) return;
    const pidNum = parseInt(patient.id, 10);
    if (isNaN(pidNum)) return;

    const current = expansions[pidNum] || {};
    const newOpen = !current.open;

    let fetchedVersions = current.versions || null;
    let versionsLoading = false;

    if (newOpen && !fetchedVersions) {
      versionsLoading = true;
      setExpansions({
        ...expansions,
        [pidNum]: { ...current, open: newOpen, versionsLoading },
      });

      try {
        const url = `${API_BASE_URL}/api/patient/${pidNum}/versions`;
        const resp = await axios.get(url);
        fetchedVersions = resp.data.versions || [];

        // [CHANGED] Remove grouping by day, always keep full versions
        /*
        fetchedVersions = filterSameDayRedundantVersions(fetchedVersions);
        */
        // [END CHANGED]

        // For each version, fetch complaint rows
        for (const v of fetchedVersions) {
          const complaints = await fetchVersionComplaints(v.id);
          v.complaints = complaints;
        }
      } catch (err) {
        console.error("Error fetching versions:", err);
        setErrorMsg("Failed to fetch versions. Check logs.");
        fetchedVersions = [];
      }
      versionsLoading = false;
    }

    setExpansions((prev) => ({
      ...prev,
      [pidNum]: {
        ...prev[pidNum],
        open: newOpen,
        versions: fetchedVersions,
        versionsLoading,
        selectedVersionId: current.selectedVersionId || null,
        selectedVersion: current.selectedVersion || null,
        editing: false,
        editLoading: false,
        editData: current.editData || null,
        finalDiagnosis: current.finalDiagnosis || "",
        otherDiagnosis: current.otherDiagnosis || "",
        finalTests: current.finalTests || [],
        finalTreatment: current.finalTreatment || [],
        caseSummary: current.caseSummary || "",
        adviceOpen: current.adviceOpen || {},
        adviceLoading: current.adviceLoading || {},
      },
    }));
  };

  const handleSelectVersion = (patient, versionIdStr) => {
    const pidNum = parseInt(patient.id, 10);
    if (isNaN(pidNum)) return;

    const pexp = expansions[pidNum] || {};
    const vidNum = parseInt(versionIdStr, 10);
    if (isNaN(vidNum) || !Array.isArray(pexp.versions)) return;

    const ver = pexp.versions.find((v) => v.id === vidNum);
    setExpansions({
      ...expansions,
      [pidNum]: {
        ...pexp,
        selectedVersionId: vidNum,
        selectedVersion: ver || null,
        finalDiagnosis: "",
        otherDiagnosis: "",
        finalTests: [],
        finalTreatment: [],
        caseSummary: (ver && ver.case_summary) || "",
      },
    });
  };

  const handleGetAdviceForVersion = async (patient, versionId) => {
    const pidNum = parseInt(patient.id, 10);
    if (isNaN(pidNum)) return;
    const pexp = expansions[pidNum];
    if (!pexp || !pexp.versions) return;

    setExpansions((prev) => ({
      ...prev,
      [pidNum]: {
        ...prev[pidNum],
        adviceLoading: {
          ...prev[pidNum].adviceLoading,
          [versionId]: true,
        },
      },
    }));

    try {
      const payload = { patient_id: pidNum };
      const resp = await axios.post(
        `${API_BASE_URL}/api/advice`,
        payload
      );
      const adviceText = resp.data?.advice || "";

      const updatedVers = pexp.versions.map((v) => {
        if (v.id === versionId) {
          return { ...v, medical_advice: adviceText };
        }
        return v;
      });
      const updatedVersion = updatedVers.find((v) => v.id === versionId);

      setExpansions((prev) => ({
        ...prev,
        [pidNum]: {
          ...prev[pidNum],
          versions: updatedVers,
          selectedVersion:
            pexp.selectedVersion?.id === versionId
              ? updatedVersion
              : pexp.selectedVersion,
          adviceLoading: {
            ...prev[pidNum].adviceLoading,
            [versionId]: false,
          },
        },
      }));
      alert("Medical advice updated");
    } catch (err) {
      console.error("Error generating advice:", err);
      setErrorMsg("Failed to generate advice. Check logs.");
      setExpansions((prev) => ({
        ...prev,
        [pidNum]: {
          ...prev[pidNum],
          adviceLoading: {
            ...prev[pidNum].adviceLoading,
            [versionId]: false,
          },
        },
      }));
    }
  };

  const toggleEditPatient = async (patient) => {
    const pidNum = parseInt(patient.id, 10);
    if (isNaN(pidNum)) return;
    const pexp = expansions[pidNum] || {};
    const isEditing = !pexp.editing;

    if (isEditing && !pexp.editData) {
      setExpansions({
        ...expansions,
        [pidNum]: {
          ...pexp,
          editing: isEditing,
          editLoading: true,
        },
      });

      try {
        const res = await axios.get(
          `${API_BASE_URL}/api/patient/${pidNum}/detailed`
        );
        const data = res.data;
        const dept = data.department || "General Medicine";

        const versResp = await axios.get(
          `${API_BASE_URL}/api/patient/${pidNum}/versions`
        );
        let allVers = versResp.data.versions || [];

        // [CHANGED] Skip grouping, keep all versions
        // allVers = filterSameDayRedundantVersions(allVers);
        // [END CHANGED]

        // Sort by date desc
        allVers.sort(
          (a, b) => new Date(b.version_timestamp) - new Date(a.version_timestamp)
        );
        let lastVer = allVers[0] || null;

        let complaintStrings = [];
        if (lastVer) {
          const compRows = await fetchVersionComplaints(lastVer.id);
          if (compRows && compRows.length > 0) {
            complaintStrings = compRows
              .map((c) => (c.complaint || "").trim())
              .filter(Boolean);
          }
        }

        let effectiveChief = data.chief_complaint || "";
        if (complaintStrings.length > 0) {
          effectiveChief = complaintStrings.join(", ");
        }

        let genMedComplaints = [];
        let otherGenMedText = "";
        let cardioComplaints = [];
        let otherCardioText = "";
        let endoComplaints = [];
        let otherEndoText = "";
        let gynComplaints = [];
        let otherGynText = "";

        if (dept === "General Medicine") {
          const parsed = parseChiefComplaints(
            effectiveChief,
            complaintOptionsByDepartment["General Medicine"] || []
          );
          genMedComplaints = parsed.selected;
          otherGenMedText = parsed.otherText;
        } else if (dept === "Cardiology") {
          const parsed = parseChiefComplaints(
            effectiveChief,
            complaintOptionsByDepartment["Cardiology"] || []
          );
          cardioComplaints = parsed.selected;
          otherCardioText = parsed.otherText;
        } else if (dept === "Endocrinology") {
          const parsed = parseChiefComplaints(
            effectiveChief,
            complaintOptionsByDepartment["Endocrinology"] || []
          );
          endoComplaints = parsed.selected;
          otherEndoText = parsed.otherText;
        } else if (dept === "Gynecology") {
          const parsed = parseChiefComplaints(
            effectiveChief,
            complaintOptionsByDepartment["Gynecology"] || []
          );
          gynComplaints = parsed.selected;
          otherGynText = parsed.otherText;
        }

        // Multi-select fields (past/family/personal/allergies/med/surg)
        const selectedPastHistory = parseMultiSelectFromString(
          data.past_history
        );
        const selectedPersonalHistory = parseMultiSelectFromString(
          data.personal_history
        );
        const selectedFamilyHistory = parseMultiSelectFromString(
          data.family_history
        );
        const selectedAllergies = parseMultiSelectFromString(data.allergies);
        const selectedMedicationHistory = parseMultiSelectFromString(
          data.medication_history
        );
        const selectedSurgicalHistory = parseMultiSelectFromString(
          data.surgical_history
        );

        // City
        let cityObj = null;
        if (data.city) {
          cityObj = cityOptions.find((c) => c.value === data.city) || null;
        }

        // Blood group
        let bloodGroupObj = null;
        if (data.blood_group) {
          bloodGroupObj = { value: data.blood_group, label: data.blood_group };
        }

        // Language
        const languageOptions = [
          { value: "English", label: "English" },
          { value: "Hindi", label: "Hindi" },
          { value: "Bengali", label: "Bengali" },
          { value: "Tamil", label: "Tamil" },
          { value: "Telugu", label: "Telugu" },
          { value: "Marathi", label: "Marathi" },
          { value: "Gujarati", label: "Gujarati" },
          { value: "Kannada", label: "Kannada" },
          { value: "Malayalam", label: "Malayalam" },
          { value: "Punjabi", label: "Punjabi" },
        ];
        let preferredLangObj = null;
        if (data.preferred_language) {
          preferredLangObj = languageOptions.find(
            (l) => l.value === data.preferred_language
          ) || {
            value: data.preferred_language,
            label: data.preferred_language,
          };
        }

        // Presigned URLs
        if (data.lab_report_url) {
          data.lab_report_presigned = await fetchPresignedUrl(
            data.lab_report_url
          );
        }
        if (data.medical_imaging_url) {
          data.medical_imaging_presigned = await fetchPresignedUrl(
            data.medical_imaging_url
          );
        }
        if (data.previous_prescription_url) {
          data.previous_prescription_presigned = await fetchPresignedUrl(
            data.previous_prescription_url
          );
        }

        // Build the form data object
        const formData = {
          // Basic details
          name: data.patient_name || "",
          age: data.age || 0,
          gender: data.gender || "Male",
          contact_number: data.contact_number || "",
          department: dept,

          // Complaints (parsed from last version if present)
          chiefComplaint: effectiveChief,
          genMedComplaints,
          otherGenMedText,
          cardioComplaints,
          otherCardioText,
          endoComplaints,
          otherEndoText,
          gynComplaints,
          otherGynText,

          // Histories
          past_history: data.past_history || "",
          personal_history: data.personal_history || "",
          family_history: data.family_history || "",
          obg_history: data.obg_history || "",
          selectedPastHistory,
          selectedPersonalHistory,
          selectedFamilyHistory,
          allergies: data.allergies || "",
          selectedAllergies,
          medication_history: data.medication_history || "",
          selectedMedicationHistory,
          surgical_history: data.surgical_history || "",
          selectedSurgicalHistory,

          // Additional fields
          blood_group: data.blood_group || "",
          bloodGroupObj,
          preferred_language: data.preferred_language || "",
          preferredLangObj,
          email: data.email || "",
          address: data.address || "",
          city: data.city || "",
          cityObj,
          pin: data.pin || "",
          referred_by: data.referred_by || "",
          channel: data.channel || "",

          // Vitals
          bp: data.bp || "",
          pulse: data.pulse || "",
          height: data.height || "",
          weight: data.weight || "",
          temperature: data.temperature || "",
          bmi: data.bmi || "",
          spo2: data.spo2 || "",
          lmp: data.lmp || "",
          edd: data.edd || "",

          // Existing file URLs
          lab_report_url: data.lab_report_url || "",
          medical_imaging_url: data.medical_imaging_url || "",
          previous_prescription_url: data.previous_prescription_url || "",
          lab_report_presigned: data.lab_report_presigned || "",
          medical_imaging_presigned: data.medical_imaging_presigned || "",
          previous_prescription_presigned:
            data.previous_prescription_presigned || "",

          // Newly uploaded files
          lab_report_file: null,
          medical_imaging_file: null,
          previous_prescription_file: null,
        };

        setExpansions((prev) => ({
          ...prev,
          [pidNum]: {
            ...prev[pidNum],
            editing: true,
            editData: formData,
            editLoading: false,
          },
        }));
      } catch (err) {
        console.error("Error loading for edit:", err);
        setErrorMsg("Failed to load patient info for editing.");
        setExpansions((prev) => ({
          ...prev,
          [pidNum]: {
            ...prev[pidNum],
            editing: false,
            editLoading: false,
          },
        }));
      }
    } else {
      // Toggle off editing
      setExpansions({
        ...expansions,
        [pidNum]: {
          ...expansions[pidNum],
          editing: !expansions[pidNum].editing,
        },
      });
    }
  };

  const handleSaveFinalChoices = async (patient) => {
    // (left as-is)
  };

  const handleEditChange = (patient, field, value) => {
    const pidNum = parseInt(patient.id, 10);
    if (isNaN(pidNum)) return;
    const pexp = expansions[pidNum];
    if (!pexp) return;

    setExpansions({
      ...expansions,
      [pidNum]: {
        ...pexp,
        editData: {
          ...pexp.editData,
          [field]: value,
        },
      },
    });
  };

  const handleSaveEditWithFiles = async (patient) => {
    const pidNum = parseInt(patient.id, 10);
    if (isNaN(pidNum)) return;

    const pexp = expansions[pidNum];
    if (!pexp?.editData) return;

    setExpansions({
      ...expansions,
      [pidNum]: {
        ...pexp,
        editLoading: true,
      },
    });

    try {
      const data = pexp.editData;
      let finalChiefComplaint = data.chiefComplaint;

      // Build complaint string based on department
      if (data.department === "General Medicine") {
        finalChiefComplaint = buildComplaintString(
          data.genMedComplaints,
          data.otherGenMedText
        );
      } else if (data.department === "Cardiology") {
        finalChiefComplaint = buildComplaintString(
          data.cardioComplaints,
          data.otherCardioText
        );
      } else if (data.department === "Endocrinology") {
        finalChiefComplaint = buildComplaintString(
          data.endoComplaints,
          data.otherEndoText
        );
      } else if (data.department === "Gynecology") {
        finalChiefComplaint = buildComplaintString(
          data.gynComplaints,
          data.otherGynText
        );
      }

      // Build multi-select histories
      const pastHistoryStr = buildStringFromMultiSelect(
        data.selectedPastHistory
      );
      const personalHistoryStr = buildStringFromMultiSelect(
        data.selectedPersonalHistory
      );
      const familyHistoryStr = buildStringFromMultiSelect(
        data.selectedFamilyHistory
      );
      const allergiesStr = buildStringFromMultiSelect(data.selectedAllergies);
      const medHistoryStr = buildStringFromMultiSelect(
        data.selectedMedicationHistory
      );
      const surgHistoryStr = buildStringFromMultiSelect(
        data.selectedSurgicalHistory
      );

      // City, blood group, preferred language
      const cityVal = data.cityObj?.value || "";
      const bloodGroupVal = data.bloodGroupObj?.value || "";
      const preferredLangVal = data.preferredLangObj?.value || "";

      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("age", data.age);
      formData.append("gender", data.gender);
      formData.append("contact_number", data.contact_number);
      formData.append("department", data.department);
      formData.append("chief_complaint", finalChiefComplaint);

      formData.append("past_history", pastHistoryStr);
      formData.append("personal_history", personalHistoryStr);
      formData.append("family_history", familyHistoryStr);

      if (data.department === "Gynecology") {
        formData.append("obg_history", data.obg_history || "");
      } else {
        formData.append("obg_history", "");
      }

      formData.append("blood_group", bloodGroupVal);
      formData.append("preferred_language", preferredLangVal);
      formData.append("email", data.email || "");
      formData.append("address", data.address || "");
      formData.append("city", cityVal);
      formData.append("pin", data.pin || "");
      formData.append("referred_by", data.referred_by || "");
      formData.append("channel", data.channel || "");

      // Vitals
      formData.append("bp", data.bp || "");
      formData.append("pulse", data.pulse || "");
      formData.append("height", data.height || "");
      formData.append("weight", data.weight || "");
      formData.append("temperature", data.temperature || "");
      formData.append("bmi", data.bmi || "");
      formData.append("spo2", data.spo2 || "");
      formData.append("lmp", data.lmp || "");
      formData.append("edd", data.edd || "");

      // Allergies / med / surgical
      formData.append("allergies", allergiesStr);
      formData.append("medication_history", medHistoryStr);
      formData.append("surgical_history", surgHistoryStr);

      // Files
      if (data.lab_report_file) {
        formData.append("lab_report_file", data.lab_report_file);
      }
      if (data.medical_imaging_file) {
        formData.append("medical_imaging_file", data.medical_imaging_file);
      }
      if (data.previous_prescription_file) {
        formData.append(
          "previous_prescription_file",
          data.previous_prescription_file
        );
      }

      await axios.post(
        `${API_BASE_URL}/api/patient/${pidNum}/update`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      // [CHANGED] After saving, re-fetch versions to see the newly created version
      const fetchUrl = `${API_BASE_URL}/api/patient/${pidNum}/versions`;
      const resp = await axios.get(fetchUrl);
      let updatedVersions = resp.data.versions || [];
      // updatedVersions = filterSameDayRedundantVersions(updatedVersions);
      // fetch complaint rows
      for (const v of updatedVersions) {
        const complaints = await fetchVersionComplaints(v.id);
        v.complaints = complaints;
      }
      // [END CHANGED]

      alert("Patient updated successfully (new version created)!");

      setExpansions((prev) => ({
        ...prev,
        [pidNum]: {
          ...prev[pidNum],
          editing: false,
          editLoading: false,
          // [CHANGED] Store updated versions so the new version is shown
          versions: updatedVersions,
          selectedVersionId: null,
          selectedVersion: null,
          // [END CHANGED]
        },
      }));
    } catch (err) {
      console.error("Error updating patient with files:", err);
      setErrorMsg("Failed to update patient. Check logs.");
      setExpansions((prev) => ({
        ...prev,
        [pidNum]: {
          ...prev[pidNum],
          editLoading: false,
        },
      }));
    }
  };

  const renderVersionsForPatient = (patient) => {
    const pidNum = parseInt(patient.id, 10);
    if (isNaN(pidNum)) return null;
    const pexp = expansions[pidNum];
    if (!pexp || !pexp.open) return null;

    if (pexp.versionsLoading) {
      return <div style={{ margin: "1rem 0" }}>Loading versions...</div>;
    }
    if (!Array.isArray(pexp.versions)) {
      return null;
    }

    return (
      <div className="versions-container">
        <label>Choose a Version:</label>
        <select
          value={pexp.selectedVersionId || ""}
          onChange={(e) => handleSelectVersion(patient, e.target.value)}
        >
          <option value="">-- Select Version --</option>
          {pexp.versions.map((ver) => {
            const ts = new Date(ver.version_timestamp).toLocaleString();
            return (
              <option key={ver.id} value={ver.id}>
                {ts} (vID: {ver.id})
              </option>
            );
          })}
        </select>

        {pexp.selectedVersion && (
          <VersionDetail
            patient={patient}
            version={pexp.selectedVersion}
            adviceOpen={
              pexp.adviceOpen ? pexp.adviceOpen[pexp.selectedVersion.id] : false
            }
            toggleAdvice={(vid) =>
              setExpansions((prev) => ({
                ...prev,
                [pidNum]: {
                  ...prev[pidNum],
                  adviceOpen: {
                    ...prev[pidNum].adviceOpen,
                    [vid]: !prev[pidNum].adviceOpen?.[vid],
                  },
                },
              }))
            }
            handleGetAdviceForVersion={handleGetAdviceForVersion}
            openPreview={openPreview}
            isAdviceLoading={
              pexp.adviceLoading?.[pexp.selectedVersion.id] || false
            }
          />
        )}
      </div>
    );
  };

  const renderEditPanel = (patient) => {
    const pidNum = parseInt(patient.id, 10);
    if (isNaN(pidNum)) return null;

    const pexp = expansions[pidNum];
    if (!pexp?.editing) return null;

    if (pexp.editLoading) {
      return (
        <div className="edit-panel">
          <p>Loading patient data...</p>
        </div>
      );
    }

    if (!pexp.editData) {
      return null;
    }

    const data = pexp.editData;
    const department = data.department || "General Medicine";
    const saveBtnClass = pexp.editLoading ? "loading" : "";

    // Blood group + language
    const bloodGroupOptions = [
      { value: "A+", label: "A+" },
      { value: "A-", label: "A-" },
      { value: "B+", label: "B+" },
      { value: "B-", label: "B-" },
      { value: "O+", label: "O+" },
      { value: "O-", label: "O-" },
      { value: "AB+", label: "AB+" },
      { value: "AB-", label: "AB-" },
    ];
    const languageOptions = [
      { value: "English", label: "English" },
      { value: "Hindi", label: "Hindi" },
      { value: "Bengali", label: "Bengali" },
      { value: "Tamil", label: "Tamil" },
      { value: "Telugu", label: "Telugu" },
      { value: "Marathi", label: "Marathi" },
      { value: "Gujarati", label: "Gujarati" },
      { value: "Kannada", label: "Kannada" },
      { value: "Malayalam", label: "Malayalam" },
      { value: "Punjabi", label: "Punjabi" },
    ];

    const handleDepartmentChange = (newDept) => {
      handleEditChange(patient, "department", newDept);
    };

    const renderComplaintSelector = () => {
      if (department === "General Medicine") {
        return (
          <div className="form-group wide">
            <label>Chief Complaint (General Medicine)</label>
            <Select
              isMulti
              options={complaintOptionsByDepartment["General Medicine"]}
              value={data.genMedComplaints}
              onChange={(selected) => {
                handleEditChange(patient, "genMedComplaints", selected);
              }}
              className="react-select-container"
              classNamePrefix="react-select"
              filterOption={prefixFilterOption}
            />
            {data.genMedComplaints?.some((opt) => opt.value === "Other") && (
              <input
                type="text"
                placeholder="Specify other..."
                value={data.otherGenMedText}
                onChange={(e) =>
                  handleEditChange(patient, "otherGenMedText", e.target.value)
                }
                style={{ marginTop: "6px" }}
              />
            )}
          </div>
        );
      } else if (department === "Cardiology") {
        return (
          <div className="form-group wide">
            <label>Chief Complaint (Cardiology)</label>
            <Select
              isMulti
              options={complaintOptionsByDepartment["Cardiology"]}
              value={data.cardioComplaints}
              onChange={(selected) => {
                handleEditChange(patient, "cardioComplaints", selected);
              }}
              className="react-select-container"
              classNamePrefix="react-select"
              filterOption={prefixFilterOption}
            />
            {data.cardioComplaints?.some((opt) => opt.value === "Other") && (
              <input
                type="text"
                placeholder="Specify other..."
                value={data.otherCardioText}
                onChange={(e) =>
                  handleEditChange(patient, "otherCardioText", e.target.value)
                }
                style={{ marginTop: "6px" }}
              />
            )}
          </div>
        );
      } else if (department === "Endocrinology") {
        return (
          <div className="form-group wide">
            <label>Chief Complaint (Endocrinology)</label>
            <Select
              isMulti
              options={complaintOptionsByDepartment["Endocrinology"]}
              value={data.endoComplaints}
              onChange={(selected) => {
                handleEditChange(patient, "endoComplaints", selected);
              }}
              className="react-select-container"
              classNamePrefix="react-select"
              filterOption={prefixFilterOption}
            />
            {data.endoComplaints?.some((opt) => opt.value === "Other") && (
              <input
                type="text"
                placeholder="Specify other..."
                value={data.otherEndoText}
                onChange={(e) =>
                  handleEditChange(patient, "otherEndoText", e.target.value)
                }
                style={{ marginTop: "6px" }}
              />
            )}
          </div>
        );
      } else if (department === "Gynecology") {
        return (
          <div className="form-group wide">
            <label>Chief Complaint (Gynecology)</label>
            <Select
              isMulti
              options={complaintOptionsByDepartment["Gynecology"]}
              value={data.gynComplaints}
              onChange={(selected) => {
                handleEditChange(patient, "gynComplaints", selected);
              }}
              className="react-select-container"
              classNamePrefix="react-select"
              filterOption={prefixFilterOption}
            />
            {data.gynComplaints?.some((opt) => opt.value === "Other") && (
              <input
                type="text"
                placeholder="Specify other..."
                value={data.otherGynText}
                onChange={(e) =>
                  handleEditChange(patient, "otherGynText", e.target.value)
                }
                style={{ marginTop: "6px" }}
              />
            )}
          </div>
        );
      } else {
        return (
          <div className="form-group wide">
            <label>Chief Complaint</label>
            <input
              type="text"
              value={data.chiefComplaint}
              onChange={(e) =>
                handleEditChange(patient, "chiefComplaint", e.target.value)
              }
            />
          </div>
        );
      }
    };

    return (
      <div className="edit-panel">
        <h4>Editing Patient ID: {patient.id}</h4>
        <div className="form-row">
          <div className="form-group">
            <label>Name</label>
            <input
              value={data.name}
              onChange={(e) =>
                handleEditChange(patient, "name", e.target.value)
              }
            />
          </div>
          <div className="form-group">
            <label>Age</label>
            <input
              type="number"
              value={data.age}
              onChange={(e) => handleEditChange(patient, "age", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Gender</label>
            <select
              value={data.gender}
              onChange={(e) =>
                handleEditChange(patient, "gender", e.target.value)
              }
            >
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </div>
          <div className="form-group">
            <label>Contact Number</label>
            <input
              value={data.contact_number}
              onChange={(e) =>
                handleEditChange(patient, "contact_number", e.target.value)
              }
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Department</label>
            <select
              value={department}
              onChange={(e) => handleDepartmentChange(e.target.value)}
            >
              <option>General Medicine</option>
              <option>Cardiology</option>
              <option>Gastroenterology</option>
              <option>Neurology</option>
              <option>Dermatology</option>
              <option>Gynecology</option>
              <option>Pulmonology</option>
              <option>Rheumatology</option>
              <option>Nephrology</option>
              <option>Hematology</option>
              <option>Infectious Diseases</option>
              <option>Psychiatry</option>
              <option>Pediatrics</option>
              <option>Orthopedics</option>
              <option>Ophthalmology</option>
              <option>Otolaryngology</option>
              <option>Urology</option>
              <option>Oncology</option>
              <option>Endocrinology</option>
            </select>
          </div>
          {renderComplaintSelector()}
        </div>

        {/* Additional Patient Info */}
        <div className="form-row">
          <div className="form-group">
            <label>Blood Group</label>
            <Select
              options={bloodGroupOptions}
              placeholder="Select Blood Group..."
              value={data.bloodGroupObj}
              onChange={(selected) => {
                handleEditChange(patient, "bloodGroupObj", selected);
              }}
              isClearable
              filterOption={prefixFilterOption}
              classNamePrefix="react-select"
            />
          </div>

          <div className="form-group">
            <label>Preferred Language</label>
            <Select
              options={languageOptions}
              placeholder="Language..."
              value={data.preferredLangObj}
              onChange={(selected) => {
                handleEditChange(patient, "preferredLangObj", selected);
              }}
              isClearable
              filterOption={prefixFilterOption}
              classNamePrefix="react-select"
            />
          </div>

          <div className="form-group">
            <label>City</label>
            <Select
              options={cityOptions}
              placeholder="Select City..."
              value={data.cityObj}
              onChange={(selected) => {
                handleEditChange(patient, "cityObj", selected);
              }}
              isClearable
              filterOption={prefixFilterOption}
              classNamePrefix="react-select"
            />
          </div>

          <div className="form-group">
            <label>Pin/Area</label>
            <input
              type="text"
              value={data.pin}
              onChange={(e) => handleEditChange(patient, "pin", e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={data.email}
              onChange={(e) =>
                handleEditChange(patient, "email", e.target.value)
              }
            />
          </div>
          <div className="form-group">
            <label>Address</label>
            <input
              type="text"
              value={data.address}
              onChange={(e) =>
                handleEditChange(patient, "address", e.target.value)
              }
            />
          </div>
          <div className="form-group">
            <label>Referred By</label>
            <input
              type="text"
              value={data.referred_by}
              onChange={(e) =>
                handleEditChange(patient, "referred_by", e.target.value)
              }
            />
          </div>
          <div className="form-group">
            <label>Channel</label>
            <input
              type="text"
              value={data.channel}
              onChange={(e) =>
                handleEditChange(patient, "channel", e.target.value)
              }
            />
          </div>
        </div>

        {/* Histories as CreatableSelect multi */}
        <div className="form-row">
          <div className="form-group wide">
            <label>Past History</label>
            <CreatableSelect
              isMulti
              value={data.selectedPastHistory}
              onChange={(selected) =>
                handleEditChange(patient, "selectedPastHistory", selected)
              }
              options={pastHistorySuggestions.map((s) => ({
                value: s,
                label: s,
              }))}
              placeholder="Select or type..."
              filterOption={prefixFilterOption}
              classNamePrefix="react-select"
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group wide">
            <label>Personal History</label>
            <CreatableSelect
              isMulti
              value={data.selectedPersonalHistory}
              onChange={(selected) =>
                handleEditChange(patient, "selectedPersonalHistory", selected)
              }
              options={personalHistorySuggestions.map((s) => ({
                value: s,
                label: s,
              }))}
              placeholder="Select or type..."
              filterOption={prefixFilterOption}
              classNamePrefix="react-select"
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group wide">
            <label>Family History</label>
            <CreatableSelect
              isMulti
              value={data.selectedFamilyHistory}
              onChange={(selected) =>
                handleEditChange(patient, "selectedFamilyHistory", selected)
              }
              options={familyHistorySuggestions.map((s) => ({
                value: s,
                label: s,
              }))}
              placeholder="Select or type..."
              filterOption={prefixFilterOption}
              classNamePrefix="react-select"
            />
          </div>
        </div>

        {department === "Gynecology" && (
          <div className="form-row">
            <div className="form-group wide">
              <label>OBG History</label>
              <textarea
                rows="2"
                value={data.obg_history}
                onChange={(e) =>
                  handleEditChange(patient, "obg_history", e.target.value)
                }
              />
            </div>
          </div>
        )}

        <div className="form-row">
          <div className="form-group wide">
            <label>Allergies</label>
            <CreatableSelect
              isMulti
              value={data.selectedAllergies}
              onChange={(selected) =>
                handleEditChange(patient, "selectedAllergies", selected)
              }
              options={allergySuggestions.map((s) => ({ value: s, label: s }))}
              placeholder="Select or type allergies..."
              filterOption={prefixFilterOption}
              classNamePrefix="react-select"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group wide">
            <label>Medication History</label>
            <CreatableSelect
              isMulti
              value={data.selectedMedicationHistory}
              onChange={(selected) =>
                handleEditChange(patient, "selectedMedicationHistory", selected)
              }
              options={medicationHistorySuggestions.map((s) => ({
                value: s,
                label: s,
              }))}
              placeholder="Select or type medication history..."
              filterOption={prefixFilterOption}
              classNamePrefix="react-select"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group wide">
            <label>Surgical History</label>
            <CreatableSelect
              isMulti
              value={data.selectedSurgicalHistory}
              onChange={(selected) =>
                handleEditChange(patient, "selectedSurgicalHistory", selected)
              }
              options={surgicalHistorySuggestions.map((s) => ({
                value: s,
                label: s,
              }))}
              placeholder="Select or type surgeries..."
              filterOption={prefixFilterOption}
              classNamePrefix="react-select"
            />
          </div>
        </div>

        {/* Vitals */}
        <h5 style={{ marginTop: "1rem" }}>Vitals</h5>
        <div className="form-row">
          <div className="form-group">
            <label>BP</label>
            <input
              type="text"
              value={data.bp}
              onChange={(e) => handleEditChange(patient, "bp", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Pulse</label>
            <input
              type="text"
              value={data.pulse}
              onChange={(e) =>
                handleEditChange(patient, "pulse", e.target.value)
              }
            />
          </div>
          <div className="form-group">
            <label>Height (cm)</label>
            <input
              type="text"
              value={data.height}
              onChange={(e) =>
                handleEditChange(patient, "height", e.target.value)
              }
            />
          </div>
          <div className="form-group">
            <label>Weight (kg)</label>
            <input
              type="text"
              value={data.weight}
              onChange={(e) =>
                handleEditChange(patient, "weight", e.target.value)
              }
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Temperature (°C)</label>
            <input
              type="text"
              value={data.temperature}
              onChange={(e) =>
                handleEditChange(patient, "temperature", e.target.value)
              }
            />
          </div>
          <div className="form-group">
            <label>BMI</label>
            <input
              type="text"
              value={data.bmi}
              onChange={(e) => handleEditChange(patient, "bmi", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>SPO2 (%)</label>
            <input
              type="text"
              value={data.spo2}
              onChange={(e) =>
                handleEditChange(patient, "spo2", e.target.value)
              }
            />
          </div>
        </div>

        {department === "Gynecology" && (
          <>
            <h5 style={{ marginTop: "1rem" }}>OBG / Pregnancy</h5>
            <div className="form-row">
              <div className="form-group">
                <label>LMP</label>
                <input
                  type="date"
                  value={data.lmp}
                  onChange={(e) =>
                    handleEditChange(patient, "lmp", e.target.value)
                  }
                />
              </div>
              <div className="form-group">
                <label>EDD</label>
                <input
                  type="date"
                  value={data.edd}
                  onChange={(e) =>
                    handleEditChange(patient, "edd", e.target.value)
                  }
                />
              </div>
            </div>
          </>
        )}

        {/* File Uploads */}
        <h5 style={{ marginTop: "1rem" }}>File Uploads</h5>
        <div className="form-row">
          <div className="form-group file-upload-group">
            <label>Upload Lab Report (PDF)</label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) =>
                handleEditChange(patient, "lab_report_file", e.target.files[0])
              }
            />
            {data.lab_report_presigned && (
              <small style={{ display: "block", marginTop: "4px" }}>
                Currently:{" "}
                <span
                  className="preview-link"
                  onClick={() => openPreview(data.lab_report_presigned, "pdf")}
                >
                  View Lab PDF
                </span>
              </small>
            )}
          </div>
          <div className="form-group file-upload-group">
            <label>Medical Image (PNG/JPG/PDF)</label>
            <input
              type="file"
              accept=".pdf,image/png,image/jpeg"
              onChange={(e) =>
                handleEditChange(
                  patient,
                  "medical_imaging_file",
                  e.target.files[0]
                )
              }
            />
            {data.medical_imaging_presigned && (
              <small style={{ display: "block", marginTop: "4px" }}>
                Currently:{" "}
                <span
                  className="preview-link"
                  onClick={() =>
                    openPreview(data.medical_imaging_presigned, "image")
                  }
                >
                  View Image
                </span>
              </small>
            )}
          </div>
          <div className="form-group file-upload-group">
            <label>Previous Prescription (PDF/JPG/PNG)</label>
            <input
              type="file"
              accept=".pdf,image/png,image/jpeg"
              onChange={(e) =>
                handleEditChange(
                  patient,
                  "previous_prescription_file",
                  e.target.files[0]
                )
              }
            />
            {data.previous_prescription_presigned && (
              <small style={{ display: "block", marginTop: "4px" }}>
                Currently:{" "}
                <span
                  className="preview-link"
                  onClick={() =>
                    openPreview(
                      data.previous_prescription_presigned,
                      data.previous_prescription_url &&
                        data.previous_prescription_url
                          .toLowerCase()
                          .endsWith(".pdf")
                        ? "pdf"
                        : "image"
                    )
                  }
                >
                  View Prescription
                </span>
              </small>
            )}
          </div>
        </div>

        <button
          className={`patient-item-btn ${saveBtnClass}`}
          onClick={() => handleSaveEditWithFiles(patient)}
          disabled={pexp.editLoading}
        >
          {pexp.editLoading ? "Saving..." : "Save Updated Patient"}
        </button>
      </div>
    );
  };

  const renderResultsList = () => {
    if (count > 0) {
      return (
        <p>
          Found <strong>{count}</strong> record(s).
        </p>
      );
    }
    if (
      searchResults.length === 0 &&
      (patientId || name || age || contact) &&
      !errorMsg
    ) {
      return (
        <div className="no-results">
          <p>No matching records found.</p>
        </div>
      );
    }
    return null;
  };
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const openBillingModal = (patient) => {
    setSelectedPatient(patient);
    setShowBillingModal(true);
  };
  return (
    <div className="search-patient-container">
      <h2 className="search-title">Search Patient Records</h2>
      {errorMsg && <div className="search-error">{errorMsg}</div>}
      <div className="search-form">
        <div className="search-group">
          <label>Patient ID:</label>
          <input
            type="text"
            placeholder="e.g. 101"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          />
        </div>
        <div className="search-group">
          <label>Name:</label>
          <input
            type="text"
            placeholder="e.g. John"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="search-group">
          <label>Age:</label>
          <input
            type="number"
            placeholder="e.g. 30"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </div>
        <div className="search-group">
          <label>Contact:</label>
          <input
            type="text"
            placeholder="e.g. 1234567890"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
        </div>

        <button
          className={`search-btn ${isSearching ? "loading" : ""}`}
          onClick={handleSearch}
          disabled={isSearching}
        >
          {isSearching ? "Searching..." : "Search"}
        </button>
      </div>
      <div className="results-container fade-in">
        {renderResultsList()}

        {searchResults.length > 0 && (
          <table className="patients-table w-full">
            <thead>
              <tr>
                <th className="text-left">ID</th>
                <th className="text-left">Name</th>
                <th className="text-left">Age</th>
                <th className="text-left">Contact</th>
                <th className="text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {searchResults.map((patient) => {
                const pidNum = parseInt(patient.id, 10);
                const pexp = expansions[pidNum] || {};
                const versionsBtnClass = pexp.versionsLoading ? "loading" : "";
                const editBtnClass = pexp.editLoading ? "loading" : "";

                return (
                  <React.Fragment key={patient.id}>
                    <tr>
                      <td>{patient.id}</td>
                      <td>{patient.patient_name}</td>
                      <td>{patient.age}</td>
                      <td>{patient.contact_number}</td>
                      <td>
                        <div className="patient-item-btns">
                          <button
                            className={`patient-item-btn ${versionsBtnClass}`}
                            onClick={() => toggleViewVersions(patient)}
                          >
                            {pexp.versionsLoading
                              ? "Loading..."
                              : pexp.open
                              ? "Hide Versions"
                              : "View Versions"}
                          </button>
                          <button
                            className={`patient-item-btn ${editBtnClass}`}
                            onClick={() => toggleEditPatient(patient)}
                            disabled={pexp.editLoading}
                          >
                            {pexp.editLoading
                              ? "Loading..."
                              : pexp.editing
                              ? "Cancel Edit"
                              : "Edit Patient"}
                          </button>

                          {/* Add Billing Button - keeping existing styling classes */}
                          <button
                            className="patient-item-btn"
                            onClick={() => openBillingModal(patient)}
                          >
                            Billing
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Row for Edit Panel if editing */}
                    {pexp.editing && (
                      <tr>
                        <td colSpan="5">{renderEditPanel(patient)}</td>
                      </tr>
                    )}
                    {/* Row for Versions if open */}
                    {pexp.open && (
                      <tr>
                        <td colSpan="5">{renderVersionsForPatient(patient)}</td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {selectedPatient && (
        <BillingModal
          visible={showBillingModal}
          close={() => setShowBillingModal(false)}
          pid={selectedPatient.id}
          patientInfo={{
            name: selectedPatient.patient_name,
            age: selectedPatient.age,
            gender: selectedPatient.gender,
            phone: selectedPatient.contact_number,
          }}
        />
      )}
      {preview.open && (
        <div className="modal-overlay" onClick={closePreview}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={closePreview}>
              &times;
            </button>
            {preview.type === "pdf" ? (
              <iframe
                src={preview.url}
                title="File Preview"
                width="100%"
                height="600px"
                frameBorder="0"
              />
            ) : (
              <img
                src={preview.url}
                alt="Preview"
                style={{ maxWidth: "100%" }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchPatients;
