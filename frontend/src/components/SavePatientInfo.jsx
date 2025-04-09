import React, { useState, useEffect, useRef } from "react";
import BillingToast from "./BillingToast";
import { Slide } from "react-toastify";
import axios from "axios";
import Select from "react-select";
import CreatableSelect from "react-select/creatable";
import "./SavePatientInfo.css";
import "./autosuggest-theme.css";
import BillingModal from "./BillingModal";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  complaintOptionsByDepartment,
  pastHistorySuggestions,
  personalHistorySuggestions,
  familyHistorySuggestions,
  cityOptions,
  allergySuggestions,
  medicationHistorySuggestions,
  surgicalHistorySuggestions,
  frequencySuggestions,
  severitySuggestions,
  durationSuggestions,
} from "./constants";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const prefixFilterOption = (option, inputValue) => {
  if (option.data && option.data.__isNew__) {
    return true;
  }
  return option.label.toLowerCase().startsWith(inputValue.toLowerCase());
};

function SavePatientInfo() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("Male");
  const [contact, setContact] = useState("");

  const [showMorePatientInfo, setShowMorePatientInfo] = useState(false);
  const [showMedicalInfo, setShowMedicalInfo] = useState(false);

  const defaultVisibility = {
    bloodGroup: true,
    preferredLanguage: true,
    city: true,
    pin: true,
    email: true,
    address: true,
    referredBy: true,
    channel: true,
    pastHistory: true,
    personalHistory: true,
    familyHistory: true,
    allergies: true,
    medicationHistory: true,
    surgicalHistory: true,
    vitals: true,
    obgPregnancy: true,
    uploads: true,
  };

  const [uhid, setUhid] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [consultantDoctor, setConsultantDoctor] = useState(null);

  // Store all doctors as options to auto-suggest in CreatableSelect
  const [doctorOptions, setDoctorOptions] = useState([]);

  useEffect(() => {
    // Fetch doctors from our backend
    axios
      .get(`${API_BASE_URL}/api/doctors`)
      .then((res) => {
        const options = res.data.map((doc) => ({
          value: doc.name,
          label: doc.name,
        }));
        setDoctorOptions(options);
      })
      .catch((err) => {
        console.error("Error fetching doctors:", err);
      });
  }, []);

  const [fieldVisibility, setFieldVisibility] = useState(defaultVisibility);
  const [showFieldCustomizer, setShowFieldCustomizer] = useState(false);

  const renderFieldCustomizerModal = () => {
    if (!showFieldCustomizer) return null;
    const fieldOptions = [
      ["bloodGroup", "Blood Group"],
      ["preferredLanguage", "Preferred Language"],
      ["city", "City"],
      ["pin", "Area / Pin"],
      ["email", "Email"],
      ["address", "Address"],
      ["referredBy", "Referred By"],
      ["channel", "Channel"],
      ["pastHistory", "Past History"],
      ["personalHistory", "Personal History"],
      ["familyHistory", "Family History"],
      ["allergies", "Allergies"],
      ["medicationHistory", "Medication History"],
      ["surgicalHistory", "Surgical / Procedural History"],
      ["vitals", "Vitals"],
      ["obgPregnancy", "OBG / Pregnancy"],
      ["uploads", "Uploads (Lab/Prescription)"],
    ];

    const handleToggleField = (fieldKey) => {
      setFieldVisibility((prev) => ({
        ...prev,
        [fieldKey]: !prev[fieldKey],
      }));
    };

    return (
      <div
        className="modal-overlay"
        onClick={() => setShowFieldCustomizer(false)}
      >
        <div
          className="modal-content small-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="close-modal"
            onClick={() => setShowFieldCustomizer(false)}
          >
            &times;
          </button>
          <h3>Customize Fields</h3>
          <div className="field-list">
            {fieldOptions.map(([key, label]) => (
              <div key={key} className="field-list-item">
                <label>
                  <input
                    type="checkbox"
                    checked={fieldVisibility[key]}
                    onChange={() => handleToggleField(key)}
                    style={{ marginRight: "6px" }}
                  />
                  {label}
                </label>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "right", marginTop: "1rem" }}>
            <button
              className="modal-save-btn"
              onClick={() => setShowFieldCustomizer(false)}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  };

  const [bloodGroup, setBloodGroup] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [pin, setPin] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [channel, setChannel] = useState("");

  const [department, setDepartment] = useState("General Medicine");
  const [selectedComplaints, setSelectedComplaints] = useState([]);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [historyPresentingIllness, setHistoryPresentingIllness] = useState("");
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [complaintsTable, setComplaintsTable] = useState([
    { complaint: "", frequency: "", severity: "", duration: "" },
  ]);

  const [complaintTemplates, setComplaintTemplates] = useState([]);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/api/complaint-templates?department=${department}`)
      .then((res) => {
        setComplaintTemplates(res.data.templates);
      })
      .catch((err) => {
        console.error("Error fetching templates:", err);
      });
  }, [department]);

  const getAvailableComplaintOptions = (rowIndex) => {
    const allOptions = complaintOptionsByDepartment[department] || [];
    const selectedOtherComplaints = complaintsTable
      .filter((row, index) => index !== rowIndex && row.complaint.trim() !== "")
      .map((row) => row.complaint);

    let availableOptions = allOptions.filter(
      (option) => !selectedOtherComplaints.includes(option.value)
    );

    if (
      complaintsTable[rowIndex].complaint &&
      !availableOptions.some(
        (opt) => opt.value === complaintsTable[rowIndex].complaint
      )
    ) {
      availableOptions.push({
        value: complaintsTable[rowIndex].complaint,
        label: complaintsTable[rowIndex].complaint,
      });
    }
    return availableOptions;
  };

  const handleTableChange = (index, field, value) => {
    setComplaintsTable((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      const isLastRow = index === updated.length - 1;
      const typedSomething = value.trim().length > 0;
      if (isLastRow && field === "complaint" && typedSomething) {
        updated.push({
          complaint: "",
          frequency: "",
          severity: "",
          duration: "",
        });
      }
      return updated;
    });
  };

  const removeComplaintRow = (idx) => {
    if (complaintsTable.length === 1) {
      setComplaintsTable([
        { complaint: "", frequency: "", severity: "", duration: "" },
      ]);
      return;
    }
    setComplaintsTable((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveTemplate = () => {
    const templateName = window.prompt(
      "Enter a name for this chief complaint template:"
    );
    if (templateName && templateName.trim()) {
      axios
        .post(`${API_BASE_URL}/api/complaint-template`, {
          name: templateName.trim(),
          department,
          data: complaintsTable,
        })
        .then(() => {
          alert("Template saved successfully.");
          return axios.get(
            `${API_BASE_URL}/api/complaint-templates?department=${department}`
          );
        })
        .then((res) => {
          setComplaintTemplates(res.data.templates);
        })
        .catch((err) => {
          console.error("Error saving template:", err);
          alert("Error saving template.");
        });
    }
  };

  const handleCopyTemplate = () => {
    if (complaintTemplates.length === 0) {
      alert("No saved templates available.");
      return;
    }
    setShowTemplateSelector(true);
  };

  const handleTemplateSelect = (e) => {
    const selectedName = e.target.value;
    const template = complaintTemplates.find((t) => t.name === selectedName);
    if (template) {
      setComplaintsTable(template.data);
      alert(`Template "${selectedName}" copied to chief complaints.`);
    }
    setShowTemplateSelector(false);
  };

  function renderComplaintsTable() {
    return (
      <div className="complaints-table-card">
        <div className="complaints-table-header">
          <label className="complaints-table-label">
            Chief Complaint ({department})
          </label>
          <div className="complaints-template-btns">
            <button
              type="button"
              onClick={handleSaveTemplate}
              className="template-btn"
            >
              Save Template
            </button>
            <button
              type="button"
              onClick={handleCopyTemplate}
              className="template-btn"
            >
              Copy Template
            </button>
          </div>
        </div>

        {showTemplateSelector && (
          <div className="template-selector">
            <select onChange={handleTemplateSelect} defaultValue="">
              <option value="" disabled>
                Select a template
              </option>
              {complaintTemplates.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <table className="complaints-table enhanced-complaints-table">
          <thead>
            <tr>
              <th>Complaint</th>
              <th>Frequency</th>
              <th>Severity</th>
              <th>Duration</th>
              <th className="remove-col"></th>
            </tr>
          </thead>
          <tbody>
            {complaintsTable.map((row, idx) => {
              const isLastRow = idx === complaintsTable.length - 1;
              const showRemove =
                !isLastRow ||
                row.complaint ||
                row.frequency ||
                row.severity ||
                row.duration;
              return (
                <tr key={idx}>
                  <td>
                    <CreatableSelect
                      classNamePrefix="react-select"
                      isClearable
                      placeholder="Type or select complaint..."
                      options={getAvailableComplaintOptions(idx)}
                      value={
                        row.complaint
                          ? { label: row.complaint, value: row.complaint }
                          : null
                      }
                      onChange={(selected) =>
                        handleTableChange(
                          idx,
                          "complaint",
                          selected ? selected.value : ""
                        )
                      }
                      onCreateOption={(newVal) =>
                        handleTableChange(idx, "complaint", newVal)
                      }
                      menuPortalTarget={document.body}
                      styles={{
                        container: (provided) => ({
                          ...provided,
                          width: "100%",
                        }),
                        menuPortal: (provided) => ({
                          ...provided,
                          zIndex: 9999,
                        }),
                      }}
                      filterOption={prefixFilterOption}
                    />
                  </td>
                  <td>
                    <CreatableSelect
                      classNamePrefix="react-select"
                      isClearable
                      placeholder="Type or select frequency..."
                      options={frequencySuggestions.map((s) => ({
                        value: s,
                        label: s,
                      }))}
                      value={
                        row.frequency
                          ? { label: row.frequency, value: row.frequency }
                          : null
                      }
                      onChange={(selected) =>
                        handleTableChange(
                          idx,
                          "frequency",
                          selected ? selected.value : ""
                        )
                      }
                      onCreateOption={(newVal) =>
                        handleTableChange(idx, "frequency", newVal)
                      }
                      menuPortalTarget={document.body}
                      styles={{
                        container: (provided) => ({
                          ...provided,
                          width: "100%",
                        }),
                        menuPortal: (provided) => ({
                          ...provided,
                          zIndex: 9999,
                        }),
                      }}
                      filterOption={prefixFilterOption}
                    />
                  </td>
                  <td>
                    <CreatableSelect
                      classNamePrefix="react-select"
                      isClearable
                      placeholder="Type or select severity..."
                      options={severitySuggestions.map((s) => ({
                        value: s,
                        label: s,
                      }))}
                      value={
                        row.severity
                          ? { label: row.severity, value: row.severity }
                          : null
                      }
                      onChange={(selected) =>
                        handleTableChange(
                          idx,
                          "severity",
                          selected ? selected.value : ""
                        )
                      }
                      onCreateOption={(newVal) =>
                        handleTableChange(idx, "severity", newVal)
                      }
                      menuPortalTarget={document.body}
                      styles={{
                        container: (provided) => ({
                          ...provided,
                          width: "100%",
                        }),
                        menuPortal: (provided) => ({
                          ...provided,
                          zIndex: 9999,
                        }),
                      }}
                      filterOption={prefixFilterOption}
                    />
                  </td>
                  <td>
                    <CreatableSelect
                      classNamePrefix="react-select"
                      isClearable
                      placeholder="Type or select duration..."
                      options={durationSuggestions.map((s) => ({
                        value: s,
                        label: s,
                      }))}
                      value={
                        row.duration
                          ? { label: row.duration, value: row.duration }
                          : null
                      }
                      onChange={(selected) =>
                        handleTableChange(
                          idx,
                          "duration",
                          selected ? selected.value : ""
                        )
                      }
                      onCreateOption={(newVal) =>
                        handleTableChange(idx, "duration", newVal)
                      }
                      menuPortalTarget={document.body}
                      styles={{
                        container: (provided) => ({
                          ...provided,
                          width: "100%",
                        }),
                        menuPortal: (provided) => ({
                          ...provided,
                          zIndex: 9999,
                        }),
                      }}
                      filterOption={prefixFilterOption}
                    />
                  </td>
                  <td>
                    {showRemove && (
                      <button
                        type="button"
                        onClick={() => removeComplaintRow(idx)}
                        className="remove-row-btn"
                        title="Remove this row"
                      >
                        x
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  const [selectedPastHistory, setSelectedPastHistory] = useState([]);
  const [selectedPersonalHistory, setSelectedPersonalHistory] = useState([]);
  const [selectedFamilyHistory, setSelectedFamilyHistory] = useState([]);
  const [selectedAllergies, setSelectedAllergies] = useState([]);
  const [selectedMedicationHistory, setSelectedMedicationHistory] = useState([]);
  const [selectedSurgicalHistory, setSelectedSurgicalHistory] = useState([]);

  const [bp, setBP] = useState("");
  const [pulse, setPulse] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [temperature, setTemperature] = useState("");
  const [bmi, setBMI] = useState("");
  const [spo2, setSPO2] = useState("");

  const [lmp, setLMP] = useState("");
  const [edd, setEDD] = useState("");
  const [obgHistory, setObgHistory] = useState("");

  const [cardiologyImagingType, setCardiologyImagingType] = useState("");
  const [neurologyImagingType, setNeurologyImagingType] = useState("");

  const [labReport, setLabReport] = useState(null);
  const [medicalImage, setMedicalImage] = useState(null);
  const [previousPrescription, setPreviousPrescription] = useState(null);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    if (
      /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
        userAgent
      )
    ) {
      setIsMobile(true);
    }
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (height && weight) {
      const h = parseFloat(height);
      const w = parseFloat(weight);
      if (!isNaN(h) && !isNaN(w) && h > 0) {
        const meters = h / 100;
        const calculated = w / (meters * meters);
        setBMI(calculated.toFixed(2));
      } else {
        setBMI("");
      }
    } else {
      setBMI("");
    }
  }, [height, weight]);

  useEffect(() => {
    if (lmp) {
      const d = new Date(lmp);
      if (!isNaN(d.getTime())) {
        const newEDD = new Date(d.getTime() + 280 * 24 * 60 * 60 * 1000);
        const yyyy = newEDD.getFullYear();
        const mm = String(newEDD.getMonth() + 1).padStart(2, "0");
        const dd = String(newEDD.getDate()).padStart(2, "0");
        setEDD(`${yyyy}-${mm}-${dd}`);
      } else {
        setEDD("");
      }
    } else {
      setEDD("");
    }
  }, [lmp]);

  const [savedPatientId, setSavedPatientId] = useState(null);
  const toastIdRef = useRef(null);

  useEffect(() => {
    if (department !== "Cardiology") setCardiologyImagingType("");
    if (department !== "Neurology") setNeurologyImagingType("");
  }, [department]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (parseInt(age, 10) > 120) {
      alert("Age cannot be more than 120");
      return;
    }
    setIsSubmitting(true);

    try {
      const tableJson = JSON.stringify(complaintsTable);
      const formData = new FormData();

      formData.append("name", name);
      formData.append("age", age);
      formData.append("gender", gender);
      formData.append("contact_number", contact);

      formData.append("blood_group", bloodGroup);
      formData.append("preferred_language", preferredLanguage);
      formData.append("email", email);
      formData.append("address", address);
      formData.append("city", city);
      formData.append("pin", pin);
      formData.append("referred_by", referredBy);
      formData.append("channel", channel);

      formData.append("uhid", uhid);
      formData.append("guardian_name", guardianName);
      formData.append(
        "consultant_doctor",
        consultantDoctor ? consultantDoctor.value : ""
      );

      formData.append("department", department);
      formData.append("chief_complaint_details", tableJson);
      formData.append("history_presenting_illness", historyPresentingIllness);
      formData.append(
        "past_history",
        selectedPastHistory.map((opt) => opt.value).join(", ")
      );
      formData.append(
        "personal_history",
        selectedPersonalHistory.map((opt) => opt.value).join(", ")
      );
      formData.append(
        "family_history",
        selectedFamilyHistory.map((opt) => opt.value).join(", ")
      );
      formData.append(
        "allergies",
        selectedAllergies.map((opt) => opt.value).join(", ")
      );
      formData.append(
        "medication_history",
        selectedMedicationHistory.map((opt) => opt.value).join(", ")
      );
      formData.append(
        "surgical_history",
        selectedSurgicalHistory.map((opt) => opt.value).join(", ")
      );

      formData.append("bp", bp);
      formData.append("pulse", pulse);
      formData.append("height", height);
      formData.append("weight", weight);
      formData.append("temperature", temperature);
      formData.append("bmi", bmi);
      formData.append("spo2", spo2);

      formData.append("lmp", lmp);
      formData.append("edd", edd);
      formData.append(
        "obg_history",
        department === "Gynecology" ? obgHistory : ""
      );

      formData.append(
        "cardiology_imaging_type",
        department === "Cardiology" ? cardiologyImagingType : ""
      );
      formData.append(
        "neurology_imaging_type",
        department === "Neurology" ? neurologyImagingType : ""
      );

      if (labReport) formData.append("lab_report_file", labReport);
      if (medicalImage) formData.append("medical_imaging_file", medicalImage);
      if (previousPrescription)
        formData.append("previous_prescription_file", previousPrescription);

      const res = await axios.post(`${API_BASE_URL}/api/patient`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const patientId = res.data.patient_id;
      setSavedPatientId(patientId);

      toastIdRef.current = toast(
        <BillingToast
          patientId={patientId}
          onProceedToBilling={() => setShowBillingModal(true)}
          toastId={toastIdRef.current}
          onDismiss={() => toast.dismiss(toastIdRef.current)}
        />,
        {
          autoClose: 8000,
          transition: Slide,
          closeOnClick: false,
          closeButton: false,
          draggable: true,
          position: "top-right",
          className: "bg-white shadow-lg rounded-lg border border-gray-100",
        }
      );

      // Reset form fields
      setName("");
      setAge("");
      setGender("Male");
      setContact("");
      setBloodGroup("");
      setPreferredLanguage("");
      setEmail("");
      setAddress("");
      setCity("");
      setPin("");
      setReferredBy("");
      setChannel("");
      setUhid("");
      setGuardianName("");
      setConsultantDoctor(null);
      setDepartment("General Medicine");
      setSelectedComplaints([]);
      setChiefComplaint("");
      setSelectedPastHistory([]);
      setSelectedPersonalHistory([]);
      setSelectedFamilyHistory([]);
      setSelectedAllergies([]);
      setSelectedMedicationHistory([]);
      setSelectedSurgicalHistory([]);
      setBP("");
      setPulse("");
      setHeight("");
      setWeight("");
      setTemperature("");
      setBMI("");
      setSPO2("");
      setLMP("");
      setEDD("");
      setObgHistory("");
      setCardiologyImagingType("");
      setNeurologyImagingType("");
      setLabReport(null);
      setMedicalImage(null);
      setPreviousPrescription(null);
      setComplaintsTable([
        { complaint: "", frequency: "", severity: "", duration: "" },
      ]);
      setShowMorePatientInfo(false);
      setShowMedicalInfo(false);
    } catch (err) {
      console.error("Error saving patient info:", err);
      alert("Error saving patient info.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const [infoModalSubmitting, setInfoModalSubmitting] = useState(false);
  const handleInfoModalSave = () => {
    setInfoModalSubmitting(true);
    setTimeout(() => {
      setInfoModalSubmitting(false);
      setShowMorePatientInfo(false);
    }, 800);
  };

  function renderMorePatientInfoModal() {
    if (!showMorePatientInfo) return null;
    return (
      <div
        className="modal-overlay"
        onClick={() => setShowMorePatientInfo(false)}
      >
        <div
          className="modal-content large-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="close-modal"
            onClick={() => setShowMorePatientInfo(false)}
          >
            &times;
          </button>
          <h3>More Patient Info</h3>

          {/* NEW ROW: UHID/Reg. No. & Guardian Name */}
          <div className="form-row">
            <div className="form-group">
              <label>UHID/Reg. No.</label>
              <input
                type="text"
                value={uhid}
                onChange={(e) => setUhid(e.target.value)}
                placeholder="e.g. 123456"
              />
            </div>
            <div className="form-group">
              <label>Guardian Name</label>
              <input
                type="text"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                placeholder="Guardian / Caregiver"
              />
            </div>
          </div>

          {/* NEW ROW: Consultant Doctor */}
          <div className="form-row">
            <div className="form-group wide">
              <label>Consultant Doctor</label>
              <CreatableSelect
                isClearable
                placeholder="Select or type doctor name..."
                options={doctorOptions}
                value={consultantDoctor}
                onChange={(selected) => setConsultantDoctor(selected)}
                onCreateOption={(inputValue) => {
                  const newOption = { value: inputValue, label: inputValue };
                  setConsultantDoctor(newOption);
                }}
                filterOption={prefixFilterOption}
              />
            </div>
          </div>

          <div className="form-row">
            {fieldVisibility.bloodGroup && (
              <div className="form-group">
                <label>Blood Group</label>
                <Select
                  options={[
                    { value: "A+", label: "A+" },
                    { value: "A-", label: "A-" },
                    { value: "B+", label: "B+" },
                    { value: "B-", label: "B-" },
                    { value: "O+", label: "O+" },
                    { value: "O-", label: "O-" },
                    { value: "AB+", label: "AB+" },
                    { value: "AB-", label: "AB-" },
                  ]}
                  value={
                    bloodGroup ? { value: bloodGroup, label: bloodGroup } : null
                  }
                  onChange={(selected) =>
                    setBloodGroup(selected ? selected.value : "")
                  }
                  placeholder="Select Blood Group..."
                  filterOption={prefixFilterOption}
                />
              </div>
            )}
            {fieldVisibility.preferredLanguage && (
              <div className="form-group">
                <label>Preferred Language</label>
                <Select
                  options={[
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
                  ]}
                  value={
                    preferredLanguage
                      ? { value: preferredLanguage, label: preferredLanguage }
                      : null
                  }
                  onChange={(selected) =>
                    setPreferredLanguage(selected ? selected.value : "")
                  }
                  placeholder="Select Preferred Language..."
                  filterOption={prefixFilterOption}
                />
              </div>
            )}
          </div>

          <div className="form-row">
            {fieldVisibility.city && (
              <div className="form-group">
                <label>City</label>
                <Select
                  options={cityOptions}
                  value={cityOptions.find((o) => o.value === city) || null}
                  onChange={(selected) =>
                    setCity(selected ? selected.value : "")
                  }
                  placeholder="Select City..."
                  filterOption={prefixFilterOption}
                />
              </div>
            )}
            {fieldVisibility.pin && (
              <div className="form-group">
                <label>Area / Pin</label>
                <input
                  type="text"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter Area / PIN..."
                />
              </div>
            )}
          </div>

          <div className="form-row">
            {fieldVisibility.email && (
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
            )}
            {fieldVisibility.address && (
              <div className="form-group">
                <label>Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, House #"
                />
              </div>
            )}
          </div>

          <div className="form-row">
            {fieldVisibility.referredBy && (
              <div className="form-group">
                <label>Referred By</label>
                <input
                  type="text"
                  value={referredBy}
                  onChange={(e) => setReferredBy(e.target.value)}
                  placeholder="e.g. Dr. Smith"
                />
              </div>
            )}
            {fieldVisibility.channel && (
              <div className="form-group">
                <label>Channel</label>
                <input
                  type="text"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  placeholder="e.g. Online, Walk-in"
                />
              </div>
            )}
          </div>

          <div style={{ textAlign: "right", marginTop: "1rem" }}>
            <button
              className="modal-save-btn"
              onClick={handleInfoModalSave}
              disabled={infoModalSubmitting}
            >
              {infoModalSubmitting ? "Saving..." : "Done"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -- ADDED FOR VOICE MODE --
  const [voiceMode, setVoiceMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  async function handleStartRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      mediaRecorder.onstop = async () => {
        // Begin processing
        setIsProcessingAudio(true);
        const blob = new Blob(recordedChunksRef.current, {
          type: "audio/webm",
        });
        // 1) Upload to /api/transcribe-audio for STT
        const formData = new FormData();
        formData.append("file", blob, "recorded_audio.webm");
        try {
          const sttRes = await axios.post(
            `${API_BASE_URL}/api/transcribe-audio`,
            formData,
            { headers: { "Content-Type": "multipart/form-data" } }
          );
          const transcript = sttRes.data.transcript || "";

          // 2) Next, parse transcript via GPT
          const parseRes = await axios.post(
            `${API_BASE_URL}/api/parse-voice-transcript`,
            {
              transcript,
              department,
            }
          );
          const parsed = parseRes.data;

          // Handle complaints:
          if (parsed.complaints && parsed.complaints.length > 0) {
            const newTable = parsed.complaints.map((c) => {
              if (typeof c === "string") {
                return {
                  complaint: c,
                  frequency: "",
                  severity: "",
                  duration: "",
                };
              } else {
                return {
                  complaint: c.complaint || "",
                  frequency: c.frequency || "",
                  severity: c.severity || "",
                  duration: c.duration || "",
                };
              }
            });

            // Add an extra blank row at the end:
            newTable.push({
              complaint: "",
              frequency: "",
              severity: "",
              duration: "",
            });

            setComplaintsTable((prev) => {
              const firstRowEmpty =
                prev.length === 1 &&
                !prev[0].complaint &&
                !prev[0].frequency &&
                !prev[0].severity &&
                !prev[0].duration;

              if (firstRowEmpty) {
                return newTable;
              } else {
                return [...prev, ...newTable];
              }
            });
          }

          // Past/Personal/Family/Allergies/Medication/Surgical
          if (parsed.past_history && parsed.past_history.length > 0) {
            const arr = parsed.past_history.map((p) => ({ value: p, label: p }));
            setSelectedPastHistory((prev) => [...prev, ...arr]);
          }
          if (parsed.personal_history && parsed.personal_history.length > 0) {
            const arr = parsed.personal_history.map((p) => ({
              value: p,
              label: p,
            }));
            setSelectedPersonalHistory((prev) => [...prev, ...arr]);
          }
          if (parsed.family_history && parsed.family_history.length > 0) {
            const arr = parsed.family_history.map((p) => ({
              value: p,
              label: p,
            }));
            setSelectedFamilyHistory((prev) => [...prev, ...arr]);
          }
          if (parsed.allergies && parsed.allergies.length > 0) {
            const arr = parsed.allergies.map((p) => ({ value: p, label: p }));
            setSelectedAllergies((prev) => [...prev, ...arr]);
          }
          if (parsed.medication_history && parsed.medication_history.length > 0) {
            const arr = parsed.medication_history.map((p) => ({
              value: p,
              label: p,
            }));
            setSelectedMedicationHistory((prev) => [...prev, ...arr]);
          }
          if (parsed.surgical_history && parsed.surgical_history.length > 0) {
            const arr = parsed.surgical_history.map((p) => ({
              value: p,
              label: p,
            }));
            setSelectedSurgicalHistory((prev) => [...prev, ...arr]);
          }

          // HPI
          if (parsed.hpi) {
            setHistoryPresentingIllness((prev) =>
              prev ? prev + "\n" + parsed.hpi : parsed.hpi
            );
          }

          // *** THIS IS THE KEY PART ***:
          // If parse_voice_transcript returns a "vitals" object, populate them:
          if (parsed.vitals) {
            setBP(parsed.vitals.bp || "");
            setPulse(parsed.vitals.pulse || "");
            setTemperature(parsed.vitals.temperature || "");
            setSPO2(parsed.vitals.spo2 || "");
            setHeight(parsed.vitals.height || "");
            setWeight(parsed.vitals.weight || "");
          }

          alert("Voice transcript parsed and fields updated!");
        } catch (err) {
          console.error("Error parsing voice transcript:", err);
          alert("Could not parse voice transcript. Check console for details.");
        } finally {
          setIsProcessingAudio(false);
        }
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone.");
    }
  }

  function handleStopRecording() {
    setIsRecording(false);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
  }

  const handleVoiceToggle = (newValue) => {
    setVoiceMode(newValue);
    if (newValue) {
      handleStartRecording();
    } else {
      handleStopRecording();
    }
  };
  // -- END ADDED FOR VOICE MODE --

  const [medicalModalSubmitting, setMedicalModalSubmitting] = useState(false);
  const handleMedicalModalSave = () => {
    setMedicalModalSubmitting(true);
    setTimeout(() => {
      setMedicalModalSubmitting(false);
      setShowMedicalInfo(false);
    }, 800);
  };

  function renderMedicalInfoModal() {
    if (!showMedicalInfo) return null;
    return (
      <div className="modal-overlay" onClick={() => setShowMedicalInfo(false)}>
        <div
          className="modal-content large-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="close-modal"
            onClick={() => setShowMedicalInfo(false)}
          >
            &times;
          </button>
          <h3>Medical Info</h3>

          {/* --- Voice Mode Toggle + Indicators --- */}
          <div
            style={{ display: "flex", alignItems: "center", marginBottom: "1rem" }}
          >
            <span style={{ marginRight: "10px" }}>Voice Mode:</span>
            <label className="voice-toggle-switch">
              <input
                type="checkbox"
                checked={voiceMode}
                onChange={(e) => handleVoiceToggle(e.target.checked)}
              />
              <span className="voice-toggle-slider"></span>
            </label>

            {isRecording && !isProcessingAudio && (
              <div className="recording-wave" style={{ marginLeft: "1rem" }}>
                <span className="wave-dot" />
                <span className="wave-dot" />
                <span className="wave-dot" />
                <span style={{ marginLeft: "6px" }}>Recording...</span>
              </div>
            )}
            {isProcessingAudio && (
              <div className="audio-processing-spinner" style={{ marginLeft: "1rem" }}>
                Transcribing...
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Department</label>
              <select
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  setSelectedComplaints([]);
                }}
              >
                {Object.keys(complaintOptionsByDepartment).map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">{renderComplaintsTable()}</div>

          <div className="form-row">
            <div className="form-group wide">
              <label>History of Presenting Illness (Detailed)</label>
              <textarea
                rows="2"
                value={historyPresentingIllness}
                onChange={(e) => setHistoryPresentingIllness(e.target.value)}
                placeholder="Describe HPI..."
              />
            </div>
          </div>

          {fieldVisibility.pastHistory && (
            <div className="form-row">
              <div className="form-group wide">
                <label>Past History</label>
                <CreatableSelect
                  isMulti
                  options={pastHistorySuggestions.map((s) => ({
                    value: s,
                    label: s,
                  }))}
                  value={selectedPastHistory}
                  onChange={(selected) =>
                    setSelectedPastHistory(selected || [])
                  }
                  onCreateOption={(inputValue) => {
                    const newOption = { value: inputValue, label: inputValue };
                    setSelectedPastHistory((prev) => [...prev, newOption]);
                  }}
                  placeholder="Select or type..."
                  filterOption={prefixFilterOption}
                />
              </div>
            </div>
          )}

          {fieldVisibility.personalHistory && (
            <div className="form-row">
              <div className="form-group wide">
                <label>Personal History</label>
                <CreatableSelect
                  isMulti
                  options={personalHistorySuggestions.map((s) => ({
                    value: s,
                    label: s,
                  }))}
                  value={selectedPersonalHistory}
                  onChange={(selected) =>
                    setSelectedPersonalHistory(selected || [])
                  }
                  onCreateOption={(inputValue) => {
                    const newOption = { value: inputValue, label: inputValue };
                    setSelectedPersonalHistory((prev) => [...prev, newOption]);
                  }}
                  placeholder="Select or type..."
                  filterOption={prefixFilterOption}
                />
              </div>
            </div>
          )}

          {fieldVisibility.familyHistory && (
            <div className="form-row">
              <div className="form-group wide">
                <label>Family History</label>
                <CreatableSelect
                  isMulti
                  options={familyHistorySuggestions.map((s) => ({
                    value: s,
                    label: s,
                  }))}
                  value={selectedFamilyHistory}
                  onChange={(selected) =>
                    setSelectedFamilyHistory(selected || [])
                  }
                  onCreateOption={(inputValue) => {
                    const newOption = { value: inputValue, label: inputValue };
                    setSelectedFamilyHistory((prev) => [...prev, newOption]);
                  }}
                  placeholder="Select or type..."
                  filterOption={prefixFilterOption}
                />
              </div>
            </div>
          )}

          {fieldVisibility.allergies && (
            <div className="form-row">
              <div className="form-group wide">
                <label>Allergies</label>
                <CreatableSelect
                  isMulti
                  options={allergySuggestions.map((s) => ({
                    value: s,
                    label: s,
                  }))}
                  value={selectedAllergies}
                  onChange={(selected) => setSelectedAllergies(selected || [])}
                  onCreateOption={(inputValue) => {
                    const newOption = { value: inputValue, label: inputValue };
                    setSelectedAllergies((prev) => [...prev, newOption]);
                  }}
                  placeholder="Select or type allergies..."
                  filterOption={prefixFilterOption}
                />
              </div>
            </div>
          )}

          {fieldVisibility.medicationHistory && (
            <div className="form-row">
              <div className="form-group wide">
                <label>Medication History</label>
                <CreatableSelect
                  isMulti
                  options={medicationHistorySuggestions.map((s) => ({
                    value: s,
                    label: s,
                  }))}
                  value={selectedMedicationHistory}
                  onChange={(selected) =>
                    setSelectedMedicationHistory(selected || [])
                  }
                  onCreateOption={(inputValue) => {
                    const newOption = { value: inputValue, label: inputValue };
                    setSelectedMedicationHistory((prev) => [
                      ...prev,
                      newOption,
                    ]);
                  }}
                  placeholder="Select or type medication history..."
                  filterOption={prefixFilterOption}
                />
              </div>
            </div>
          )}

          {fieldVisibility.surgicalHistory && (
            <div className="form-row">
              <div className="form-group wide">
                <label>Surgical / Procedural History</label>
                <CreatableSelect
                  isMulti
                  options={surgicalHistorySuggestions.map((s) => ({
                    value: s,
                    label: s,
                  }))}
                  value={selectedSurgicalHistory}
                  onChange={(selected) =>
                    setSelectedSurgicalHistory(selected || [])
                  }
                  onCreateOption={(inputValue) => {
                    const newOption = { value: inputValue, label: inputValue };
                    setSelectedSurgicalHistory((prev) => [...prev, newOption]);
                  }}
                  placeholder="Select or type surgeries or procedures..."
                  filterOption={prefixFilterOption}
                />
              </div>
            </div>
          )}

          {fieldVisibility.vitals && (
            <>
              <h5>Vitals</h5>
              <div className="form-row">
                <div className="form-group">
                  <label>BP</label>
                  <input
                    type="text"
                    value={bp}
                    onChange={(e) => setBP(e.target.value)}
                    placeholder="e.g. 120/80"
                  />
                </div>
                <div className="form-group">
                  <label>Pulse (bpm)</label>
                  <input
                    type="text"
                    value={pulse}
                    onChange={(e) => setPulse(e.target.value)}
                    placeholder="e.g. 72"
                  />
                </div>
                <div className="form-group">
                  <label>Height (cm)</label>
                  <input
                    type="text"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="e.g. 170"
                  />
                </div>
                <div className="form-group">
                  <label>Weight (kg)</label>
                  <input
                    type="text"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="e.g. 65"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Temperature (°C)</label>
                  <input
                    type="text"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    placeholder="e.g. 37.2"
                  />
                </div>
                <div className="form-group">
                  <label>BMI (auto)</label>
                  <input
                    type="text"
                    value={bmi}
                    readOnly
                    placeholder="Auto-calc"
                  />
                </div>
                <div className="form-group">
                  <label>SPO2 (%)</label>
                  <input
                    type="text"
                    value={spo2}
                    onChange={(e) => setSPO2(e.target.value)}
                    placeholder="e.g. 98"
                  />
                </div>
              </div>
            </>
          )}

          {fieldVisibility.obgPregnancy && department === "Gynecology" && (
            <>
              <h5>OBG / Pregnancy</h5>
              <div className="form-row">
                <div className="form-group">
                  <label>LMP</label>
                  <input
                    type="date"
                    value={lmp}
                    onChange={(e) => setLMP(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>EDD (auto)</label>
                  <input
                    type="date"
                    value={edd}
                    readOnly
                    placeholder="Calculated from LMP"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group wide">
                  <label>OBG History</label>
                  <textarea
                    rows="2"
                    value={obgHistory}
                    onChange={(e) => setObgHistory(e.target.value)}
                    placeholder="Gravida/Para, last childbirth..."
                  />
                </div>
              </div>
            </>
          )}

          {fieldVisibility.uploads && (
            <>
              <h5>Uploads</h5>
              <div className="form-row">
                <div className="form-group file-upload-group">
                  <label>Upload Lab Report (PDF/JPG/PNG)</label>
                  <div className="file-input-with-camera">
                    <input
                      type="file"
                      accept=".pdf, image/png, image/jpeg"
                      onChange={(e) => setLabReport(e.target.files[0])}
                    />
                    {labReport && (
                      <small className="selected-file-info">
                        Selected: {labReport.name}
                      </small>
                    )}

                    {isMobile && (
                      <>
                        <button
                          type="button"
                          className="camera-btn"
                          onClick={() =>
                            document.getElementById("labReportCamera").click()
                          }
                        >
                          &#128247;
                        </button>
                        <input
                          id="labReportCamera"
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => setLabReport(e.target.files[0])}
                          style={{ display: "none" }}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
              {department === "Cardiology" ? (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Cardiology Imaging Type</label>
                      <select
                        value={cardiologyImagingType}
                        onChange={(e) =>
                          setCardiologyImagingType(e.target.value)
                        }
                      >
                        <option value="">Select Type</option>
                        <option value="ECG/EKG">
                          Electrocardiogram (ECG/EKG)
                        </option>
                        <option value="Echocardiography (ECHO)">
                          Echocardiography (ECHO)
                        </option>
                        <option value="Cardiac MRI">Cardiac MRI</option>
                        <option value="CT Coronary Angiography">
                          CT Coronary Angiography
                        </option>
                      </select>
                    </div>
                  </div>
                  {cardiologyImagingType && (
                    <div className="form-row">
                      <div className="form-group file-upload-group">
                        <label>Upload {cardiologyImagingType}</label>
                        <div className="file-input-with-camera">
                          <input
                            type="file"
                            accept=".pdf, image/png, image/jpeg"
                            onChange={(e) => setMedicalImage(e.target.files[0])}
                          />
                          {medicalImage && (
                            <small className="selected-file-info">
                              Selected: {medicalImage.name}
                            </small>
                          )}
                          {isMobile && (
                            <>
                              <button
                                type="button"
                                className="camera-btn"
                                onClick={() =>
                                  document
                                    .getElementById("medicalImageCamera")
                                    .click()
                                }
                              >
                                &#128247;
                              </button>
                              <input
                                id="medicalImageCamera"
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) =>
                                  setMedicalImage(e.target.files[0])
                                }
                                style={{ display: "none" }}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : department === "Neurology" ? (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Neurology Imaging Type</label>
                      <select
                        value={neurologyImagingType}
                        onChange={(e) =>
                          setNeurologyImagingType(e.target.value)
                        }
                      >
                        <option value="">Select Type</option>
                        <option value="MRI_SPINE">MRI Spine</option>
                        <option value="MRI_HEAD">MRI Head</option>
                        <option value="CT_HEAD">CT Head</option>
                        <option value="PET_BRAIN">PET Brain</option>
                        <option value="SPECT_BRAIN">SPECT Brain</option>
                        <option value="DSA_BRAIN">DSA Brain</option>
                        <option value="Carotid_Doppler">Carotid Doppler</option>
                        <option value="TRANSCRANIAL_DOPPLER">
                          Transcranial Doppler
                        </option>
                        <option value="MYELOGRAPHY">Myelography</option>
                      </select>
                    </div>
                  </div>
                  {neurologyImagingType && (
                    <div className="form-row">
                      <div className="form-group file-upload-group">
                        <label>Upload {neurologyImagingType}</label>
                        <div className="file-input-with-camera">
                          <input
                            type="file"
                            accept=".pdf, image/png, image/jpeg"
                            onChange={(e) => setMedicalImage(e.target.files[0])}
                          />
                          {medicalImage && (
                            <small className="selected-file-info">
                              Selected: {medicalImage.name}
                            </small>
                          )}
                          {isMobile && (
                            <>
                              <button
                                type="button"
                                className="camera-btn"
                                onClick={() =>
                                  document
                                    .getElementById("medicalImageCamera")
                                    .click()
                                }
                              >
                                &#128247;
                              </button>
                              <input
                                id="medicalImageCamera"
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) =>
                                  setMedicalImage(e.target.files[0])
                                }
                                style={{ display: "none" }}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="form-row">
                  <div className="form-group file-upload-group">
                    <label>Medical Image (PDF/JPG/PNG)</label>
                    <div className="file-input-with-camera">
                      <input
                        type="file"
                        accept=".pdf, image/png, image/jpeg"
                        onChange={(e) => setMedicalImage(e.target.files[0])}
                      />
                      {medicalImage && (
                        <small className="selected-file-info">
                          Selected: {medicalImage.name}
                        </small>
                      )}
                      {isMobile && (
                        <>
                          <button
                            type="button"
                            className="camera-btn"
                            onClick={() =>
                              document
                                .getElementById("medicalImageCamera")
                                .click()
                            }
                          >
                            &#128247;
                          </button>
                          <input
                            id="medicalImageCamera"
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) => setMedicalImage(e.target.files[0])}
                            style={{ display: "none" }}
                          />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="form-row">
                <div className="form-group file-upload-group">
                  <label>Previous Prescription (PDF/JPG/PNG)</label>
                  <div className="file-input-with-camera">
                    <input
                      type="file"
                      accept=".pdf, image/png, image/jpeg"
                      onChange={(e) =>
                        setPreviousPrescription(e.target.files[0])
                      }
                    />
                    {previousPrescription && (
                      <small className="selected-file-info">
                        Selected: {previousPrescription.name}
                      </small>
                    )}
                    {isMobile && (
                      <>
                        <button
                          type="button"
                          className="camera-btn"
                          onClick={() =>
                            document.getElementById("prescriptionCamera").click()
                          }
                        >
                          &#128247;
                        </button>
                        <input
                          id="prescriptionCamera"
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) =>
                            setPreviousPrescription(e.target.files[0])
                          }
                          style={{ display: "none" }}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          <div style={{ textAlign: "right", marginTop: "1rem" }}>
            <button
              className="modal-save-btn"
              onClick={handleMedicalModalSave}
              disabled={medicalModalSubmitting}
            >
              {medicalModalSubmitting ? "Saving..." : "Done"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const [showSummaryPopover, setShowSummaryPopover] = useState(false);
  const getSelectedSummary = () => {
    const lines = [];
    if (selectedComplaints.length > 0) {
      lines.push(`Chief Complaints: ${selectedComplaints.length} selected`);
    }
    if (selectedPastHistory.length > 0) {
      lines.push(`Past History: ${selectedPastHistory.length} selected`);
    }
    if (selectedPersonalHistory.length > 0) {
      lines.push(`Personal History: ${selectedPersonalHistory.length} selected`);
    }
    if (selectedFamilyHistory.length > 0) {
      lines.push(`Family History: ${selectedFamilyHistory.length} selected`);
    }
    if (selectedAllergies.length > 0) {
      lines.push(`Allergies: ${selectedAllergies.length} selected`);
    }
    if (selectedMedicationHistory.length > 0) {
      lines.push(
        `Medication History: ${selectedMedicationHistory.length} selected`
      );
    }
    if (selectedSurgicalHistory.length > 0) {
      lines.push(
        `Surgical History: ${selectedSurgicalHistory.length} selected`
      );
    }
    let uploadCount = 0;
    if (labReport) uploadCount++;
    if (medicalImage) uploadCount++;
    if (previousPrescription) uploadCount++;
    if (uploadCount > 0) {
      lines.push(`Files Uploaded: ${uploadCount} selected`);
    }
    if (lines.length === 0) {
      return "No multiple-select items or files chosen.";
    }
    return lines.join("\n");
  };

  return (
    <div className="save-patient-info-container">
      <ToastContainer />
      <h2 className="save-patient-title">Save Patient Information</h2>
      <div className="header-links-container">
        <span
          className="overlay-link"
          onClick={() => setShowFieldCustomizer(true)}
        >
          Customize Fields
        </span>
      </div>

      <form onSubmit={handleSubmit} className="save-patient-form">
        <div className="form-row">
          <div className="form-group">
            <label>
              Patient Name <span style={{ color: "red" }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. John Doe"
            />
          </div>
          <div className="form-group">
            <label>
              Age <span style={{ color: "red" }}>*</span>
            </label>
            <input
              type="number"
              min="0"
              max="120"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              required
              placeholder="e.g. 30"
            />
          </div>
          <div className="form-group">
            <label>
              Gender <span style={{ color: "red" }}>*</span>
            </label>
            <select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </div>
          <div className="form-group">
            <label>
              Contact Number <span style={{ color: "red" }}>*</span>
            </label>
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              required
              placeholder="e.g. 9998887777"
            />
          </div>
        </div>

        <div className="add-more-links-row">
          <span
            className="overlay-link"
            onClick={() => setShowMorePatientInfo(true)}
          >
            + Add More Patient Info
          </span>
          <span
            className="overlay-link"
            onClick={() => setShowMedicalInfo(true)}
          >
            + Add More Medical Info
          </span>
        </div>

        <div className="form-submit-row">
          <button
            type="submit"
            className={`save-btn ${isSubmitting ? "loading" : ""}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save Patient Info"}
          </button>

          <div
            className="summary-icon-container"
            onMouseEnter={() => setShowSummaryPopover(true)}
            onMouseLeave={() => setShowSummaryPopover(false)}
          >
            <span className="info-summary-icon" title="View selected details">
              &#9432;
            </span>
            {showSummaryPopover && (
              <div className="info-summary-popover">
                <pre style={{ margin: 0 }}>{getSelectedSummary()}</pre>
              </div>
            )}
          </div>
        </div>
      </form>

      {renderMorePatientInfoModal()}
      {renderMedicalInfoModal()}
      {renderFieldCustomizerModal()}
      {savedPatientId && (
        <BillingModal
          visible={showBillingModal}
          close={() => setShowBillingModal(false)}
          pid={savedPatientId}
          patientInfo={{ name, age, gender, phone: contact }}
        />
      )}
    </div>
  );
}

export default SavePatientInfo;