import React, { useState, useEffect, useRef } from "react";
import { debounce } from "lodash"; 
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import CreatableSelect from "react-select/creatable";
import AsyncCreatableSelect from "react-select/async-creatable";

import {
  complaintSuggestions,
  diagnosisSuggestions,
  testSuggestions,
  TU,
  dosageSuggestions,
  whenSuggestions,
  durationSuggestions,
  unitSuggestions,
} from "./constants";

import "./PrescriptionWriting.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const PrescriptionWriting = () => {
  // Existing states
  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientGender, setPatientGender] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [drugs, setDrugs] = useState("");
  const [tests, setTests] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [generatingPresc, setGeneratingPresc] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const [includeAnalysis, setIncludeAnalysis] = useState(true);

  // NEW: For multi-field searching
  const [searchName, setSearchName] = useState("");
  const [searchContact, setSearchContact] = useState("");
  const [searchMatches, setSearchMatches] = useState([]);
  const [showMatches, setShowMatches] = useState(false);

  // Manual mode states
  const [manualMode, setManualMode] = useState(false);
  const [manualPatientName, setManualPatientName] = useState("");
  const [manualPatientAge, setManualPatientAge] = useState("");
  const [manualPatientGender, setManualPatientGender] = useState("Male");
  const [manualPatientContact, setManualPatientContact] = useState("");
  const [manualTemperature, setManualTemperature] = useState("");
  const [manualBP, setManualBP] = useState("");
  const [manualPulse, setManualPulse] = useState("");
  const [manualBMI, setManualBMI] = useState("");
  const [manualDiagnosis, setManualDiagnosis] = useState("");
  const [manualFollowUp, setManualFollowUp] = useState("");
  const [manualComplaints, setManualComplaints] = useState([]);
  const [manualTests, setManualTests] = useState([]);

  // Medicine table (Manual Mode)
  const [medicineTable, setMedicineTable] = useState([
    {
      medicine: "",
      dosage: "",
      unit: "",
      when: "",
      duration: "",
      notes: "",
    },
  ]);

  // Template states (Manual)
  const [templateList, setTemplateList] = useState([]);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  // Analysis states
  const [medicalImagingAnalysis, setMedicalImagingAnalysis] = useState("");
  const [labReportAnalysis, setLabReportAnalysis] = useState("");
  const [prescriptionAnalysis, setPrescriptionAnalysis] = useState("");
  const [hasLabReport, setHasLabReport] = useState(false);
  const [hasMedicalImaging, setHasMedicalImaging] = useState(false);
  const [hasPrescription, setHasPrescription] = useState(false);
  const [analyzingData, setAnalyzingData] = useState(false);

  // --------------------- VOICE MODE (MANUAL) ADDITIONS ---------------------
  const [voiceMode, setVoiceMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const handleVoiceToggle = (checked) => {
    setVoiceMode(checked);
    setErrorMsg("");
    setSuccessMsg("");
    if (checked) {
      handleStartRecording();
    } else {
      handleStopRecording();
    }
  };

  const handleStartRecording = async () => {
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
        setIsProcessingAudio(true);
        try {
          // 1) Transcribe via /api/transcribe-audio
          const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
          const formData = new FormData();
          formData.append("file", blob, "recorded_audio.webm");

          const sttRes = await axios.post(`${API_BASE_URL}/api/transcribe-audio`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          const transcript = sttRes.data.transcript || "";

          // 2) Parse via /api/parse-voice-prescription
          const parseRes = await axios.post(`${API_BASE_URL}/api/parse-voice-prescription`, {
            transcript,
          });
          const parsed = parseRes.data;

          // Populate fields
          // a) Basic patient info
          if (parsed.patient_name) {
            setManualPatientName((prev) => (prev ? prev : parsed.patient_name));
          }
          if (parsed.patient_age) {
            setManualPatientAge((prev) => (prev ? prev : parsed.patient_age));
          }
          if (parsed.patient_gender) {
            setManualPatientGender((prev) =>
              prev === "Male" && !prev ? parsed.patient_gender : parsed.patient_gender
            );
          }
          if (parsed.patient_contact) {
            setManualPatientContact((prev) => (prev ? prev : parsed.patient_contact));
          }

          // b) Complaints
          if (Array.isArray(parsed.complaints)) {
            setManualComplaints((prev) => {
              const combined = new Set([...prev, ...parsed.complaints]);
              return Array.from(combined);
            });
          }
          // c) Diagnosis
          if (parsed.diagnosis) {
            if (!manualDiagnosis.trim()) {
              setManualDiagnosis(parsed.diagnosis);
            } else {
              setManualDiagnosis((prev) => `${prev}, ${parsed.diagnosis}`);
            }
          }
          // d) Tests
          if (Array.isArray(parsed.tests)) {
            setManualTests((prev) => {
              const combined = new Set([...prev, ...parsed.tests]);
              return Array.from(combined);
            });
          }
          // e) Follow-up
          if (parsed.follow_up) {
            if (!manualFollowUp.trim()) {
              setManualFollowUp(parsed.follow_up);
            } else {
              setManualFollowUp((prev) => `${prev} | ${parsed.follow_up}`);
            }
          }
          // f) Vitals
          if (parsed.vitals) {
            if (parsed.vitals.temperature) setManualTemperature(parsed.vitals.temperature);
            if (parsed.vitals.bp) setManualBP(parsed.vitals.bp);
            if (parsed.vitals.pulse) setManualPulse(parsed.vitals.pulse);
            if (parsed.vitals.bmi) setManualBMI(parsed.vitals.bmi);
          }
          // g) Medicines
          if (Array.isArray(parsed.medicines) && parsed.medicines.length > 0) {
            setMedicineTable((prev) => {
              let updated = [...prev];
              const last = updated[updated.length - 1];
              const isEmptyRow =
                !last.medicine && !last.dosage && !last.unit && !last.when && !last.duration && !last.notes;

              if (isEmptyRow && updated.length === 1) {
                updated = [];
              }
              for (const m of parsed.medicines) {
                updated.push({
                  medicine: m.medicine || "",
                  dosage: m.dosage || "",
                  unit: m.unit || "",
                  when: m.when || "",
                  duration: m.duration || "",
                  notes: m.notes || "",
                });
              }
              updated.push({
                medicine: "",
                dosage: "",
                unit: "",
                when: "",
                duration: "",
                notes: "",
              });
              return updated;
            });
          }

          setSuccessMsg("Voice transcript parsed and fields updated!");
        } catch (err) {
          console.error("Error parsing voice prescription:", err);
          setErrorMsg("Could not parse voice transcript for prescription. See console.");
        } finally {
          setIsProcessingAudio(false);
        }
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setErrorMsg("Could not access microphone. Check permissions.");
    }
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
  };
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // 1) SEARCH / LOAD PATIENT (Using ID, Name, Contact) => handleLoadPatientInfo
  // -------------------------------------------------------------------------
  const handleLoadPatientInfo = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    setShowMatches(false);
    setSearchMatches([]);

    if (!patientId.trim() && !searchName.trim() && !searchContact.trim()) {
      setErrorMsg("Please enter at least Patient ID or (Name & Contact) to search.");
      return;
    }

    setLoadingPatient(true);

    try {
      const params = {};
      if (patientId.trim()) params.patient_id = patientId.trim();
      if (searchName.trim()) params.name = searchName.trim();
      if (searchContact.trim()) params.contact = searchContact.trim();

      const searchRes = await axios.get(`${API_BASE_URL}/api/search`, { params });
      const { count, records } = searchRes.data;

      if (!count || !records || records.length === 0) {
        setErrorMsg("No matching patient found. Please check your input.");
        return;
      }
      if (count > 1) {
        setSearchMatches(records);
        setShowMatches(true);
        return;
      }

      const matchedPatient = records[0];

      if (patientId && Number(patientId) !== matchedPatient.id) {
        setErrorMsg("Mismatch: That ID belongs to a different patient. Please check again.");
        return;
      }
      if (
        searchName &&
        !matchedPatient.patient_name.toLowerCase().includes(searchName.toLowerCase())
      ) {
        setErrorMsg("Mismatch: The name doesn't match that ID/contact. Please check again.");
        return;
      }
      if (
        searchContact &&
        !matchedPatient.contact_number.includes(searchContact)
      ) {
        setErrorMsg("Mismatch: The contact doesn't match that ID/name. Please check again.");
        return;
      }

      await loadSinglePatient(matchedPatient.id);
    } catch (err) {
      console.error("Error searching/loading patient:", err);
      setErrorMsg("Could not load patient info. Check console or ID.");
    } finally {
      setLoadingPatient(false);
    }
  };

  const handlePickMatch = async (pid) => {
    setShowMatches(false);
    setSearchMatches([]);
    setErrorMsg("");
    setSuccessMsg("");
    setLoadingPatient(true);
    try {
      await loadSinglePatient(pid);
    } catch (err) {
      console.error("Error picking match:", err);
      setErrorMsg("Failed to load that patient. Check console.");
    } finally {
      setLoadingPatient(false);
    }
  };

  const loadSinglePatient = async (pid) => {
    const res = await axios.get(`${API_BASE_URL}/api/patient/${pid}`);
    const data = res.data;

    setPatientId(String(pid));
    setPatientName(data.patient_name || "");
    setPatientAge(data.age?.toString() || "");
    setPatientGender(data.gender || "");
    setDiagnosis(data.final_diagnosis || "");
    setTests(data.final_tests || "");
    setDrugs(data.final_treatment_plan || "");
    setSuccessMsg(`Loaded patient #${pid}: ${data.patient_name}`);

    if (manualMode) {
      setManualPatientName(data.patient_name || "");
      setManualPatientAge(data.age?.toString() || "");
      setManualPatientGender(data.gender || "Male");
      setManualPatientContact(data.contact_number || "");
    }

    const detailResp = await axios.get(`${API_BASE_URL}/api/patient/${pid}/detailed`);
    const row = detailResp.data || {};

    if (manualMode) {
      if (row.bp) setManualBP(row.bp);
      if (row.pulse) setManualPulse(row.pulse);
      if (row.temperature) setManualTemperature(row.temperature);
      if (row.bmi) setManualBMI(row.bmi);

      const verResp = await axios.get(`${API_BASE_URL}/api/patient/${pid}/versions`);
      const versions = verResp.data.versions || [];
      if (versions.length > 0) {
        const latestVersionId = versions[0].id;
        const compResp = await axios.get(
          `${API_BASE_URL}/api/version/${latestVersionId}/complaints`
        );
        const compRows = compResp.data.complaints || [];
        const complaintVals = compRows
          .map((c) => c.complaint?.trim())
          .filter(Boolean);
        setManualComplaints(complaintVals);
      }
    }

    setMedicalImagingAnalysis("");
    setLabReportAnalysis("");
    setPrescriptionAnalysis("");
    await getAnalysisReports(row);
  };

  const getAnalysisReports = async (patientData) => {
    try {
      setAnalyzingData(true);
      const hasExistingAnalysis = !!patientData.medical_advice;
      if (hasExistingAnalysis) {
        const advice = patientData.medical_advice || "";

        if (patientData.medical_imaging_url) {
          const imgAnalysis = extractSection("Medical Image Analysis \\(if any\\)", advice);
          const cleanAnalysis = imgAnalysis.replace(/^- /gm, "").trim();
          if (cleanAnalysis && cleanAnalysis !== "None.") {
            setMedicalImagingAnalysis(cleanAnalysis);
            setHasMedicalImaging(true);
          } else {
            setMedicalImagingAnalysis("");
            setHasMedicalImaging(false);
          }
        } else {
          setMedicalImagingAnalysis("");
          setHasMedicalImaging(false);
        }

        if (patientData.lab_report_url) {
          const labAnalysis = extractSection("Lab Report Analysis \\(if any\\)", advice);
          const cleanAnalysis = labAnalysis.replace(/^- /gm, "").trim();
          if (cleanAnalysis && cleanAnalysis !== "None.") {
            setLabReportAnalysis(cleanAnalysis);
            setHasLabReport(true);
          } else {
            setLabReportAnalysis("");
            setHasLabReport(false);
          }
        } else {
          setLabReportAnalysis("");
          setHasLabReport(false);
        }

        if (patientData.previous_prescription_url) {
          const presAnalysis = extractSection("Prescription Analysis \\(if any\\)", advice);
          const cleanAnalysis = presAnalysis.replace(/^- /gm, "").trim();
          if (cleanAnalysis && cleanAnalysis !== "None.") {
            setPrescriptionAnalysis(cleanAnalysis);
            setHasPrescription(true);
          } else {
            setPrescriptionAnalysis("");
            setHasPrescription(false);
          }
        } else {
          setPrescriptionAnalysis("");
          setHasPrescription(false);
        }
      } else {
        setMedicalImagingAnalysis("");
        setHasMedicalImaging(false);
        setLabReportAnalysis("");
        setHasLabReport(false);
        setPrescriptionAnalysis("");
        setHasPrescription(false);
      }
    } catch (err) {
      console.error("Error retrieving analysis reports:", err);
      setErrorMsg("Could not retrieve analysis reports. Check logs.");
      setMedicalImagingAnalysis("");
      setHasMedicalImaging(false);
      setLabReportAnalysis("");
      setHasLabReport(false);
      setPrescriptionAnalysis("");
      setHasPrescription(false);
    } finally {
      setAnalyzingData(false);
    }
  };

  const extractSection = (section, content) => {
    const regex = new RegExp(`\\*\\*${section}\\*\\*([\\s\\S]*?)(?=\\*\\*|$)`, "i");
    const match = content.match(regex);
    return match ? match[1].trim() : "";
  };

  // Additional code from your snippet that used 'PrescriptionWriting' function:
  const [searchParams] = useSearchParams();
  const queryPatientId = searchParams.get("patient_id");

  useEffect(() => {
    if (queryPatientId) {
      setPatientId(queryPatientId);
      handleLoadPatientInfoById(queryPatientId);
    }
    // eslint-disable-next-line
  }, [queryPatientId]);

  const handleLoadPatientInfoById = async (pid) => {
    if (!pid) return;
    setPatientId(pid);
    setErrorMsg("");
    setSuccessMsg("");
    setShowMatches(false);
    setSearchMatches([]);
    setLoadingPatient(true);
    try {
      await loadSinglePatient(pid);
    } catch (err) {
      console.error("Error loading patient by query param ID:", err);
      setErrorMsg("Could not load patient from URL param. Check logs.");
    } finally {
      setLoadingPatient(false);
    }
  };

  function stripColonPart(str = "") {
    return str
      .split(",")
      .map((seg) => seg.split(":")[0].trim())
      .filter(Boolean)
      .join(", ");
  }

  function stripColonFromLines(str = "") {
    return str
      .split("\n")
      .map((line) => line.split(":")[0].trim())
      .filter(Boolean);
  }

  function buildPatientInfoString(row, usedFinalChoices) {
    let s =
      `Name: ${row.patient_name || "Unknown"}\n` +
      `Age: ${row.age || "?"}\n` +
      `Gender: ${row.gender || "?"}\n` +
      `Department: ${row.department || ""}\n` +
      `Chief Complaint: ${row.chief_complaint || ""}\n` +
      `HPI: ${row.history_of_presenting_illness || ""}\n` +
      `Past History: ${row.past_history || ""}\n` +
      `Personal History: ${row.personal_history || ""}\n` +
      `Family History: ${row.family_history || ""}\n` +
      `OBG History: ${row.obg_history || ""}\n` +
      `Allergies: ${row.allergies || ""}\n` +
      `Medication History: ${row.medication_history || ""}\n` +
      `Surgical History: ${row.surgical_history || ""}\n` +
      `BP: ${row.bp || ""}\n` +
      `Pulse: ${row.pulse || ""}\n` +
      `Temperature: ${row.temperature || ""}\n` +
      `BMI: ${row.bmi || ""}\n` +
      `SPO2: ${row.spo2 || ""}\n` +
      `LMP: ${row.lmp || ""}\n` +
      `EDD: ${row.edd || ""}\n`;

    s += usedFinalChoices
      ? "\n[Final Choices from GetMedicalAdvice have been used]\n"
      : "\n[No final choices yet; using partial data]\n";
    return s;
  }

  const handleGeneratePrescription = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    if (!patientId) {
      setErrorMsg("Please load a patient first (enter ID) or ensure a valid ID.");
      return;
    }
    setGeneratingPresc(true);

    try {
      const detailResp = await axios.get(`${API_BASE_URL}/api/patient/${patientId}/detailed`);
      const row = detailResp.data || {};

      const finalDiagArr = stripColonPart(row.final_diagnosis || "")
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);

      const finalTestsArr = stripColonPart(row.final_tests || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const finalTreatArr = stripColonFromLines(row.final_treatment_plan || "");

      const hasFinalChoices =
        finalDiagArr.length > 0 ||
        finalTestsArr.length > 0 ||
        finalTreatArr.length > 0;

      const patientInfoStr = buildPatientInfoString(row, hasFinalChoices);

      const effectiveDiagnosis = hasFinalChoices
        ? finalDiagArr.join(", ") || "Unknown"
        : (row.department ? row.department + " related conditions" : "").trim() ||
          diagnosis.trim() ||
          "Unknown";

      const effectiveTestsArr = hasFinalChoices
        ? finalTestsArr
        : tests
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);

      const effectiveTreatArr = hasFinalChoices
        ? finalTreatArr
        : drugs
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean);

      const extendedPayload = {
        diagnosis: effectiveDiagnosis,
        tests: effectiveTestsArr,
        treatments: effectiveTreatArr,
        patient_info: {
          name: row.patient_name || "",
          age: row.age || "",
          gender: row.gender || "",
          extended_info: patientInfoStr,
          image_analysis_text: medicalImagingAnalysis || "",
          lab_analysis_text: labReportAnalysis || "",
          prescription_analysis_text: prescriptionAnalysis || "",
        },
        fallback_diagnosis: diagnosis.trim(),
        fallback_tests: tests
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        fallback_drugs: drugs
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
      };

      const resp = await axios.post(
        `${API_BASE_URL}/api/prescription/generate`,
        extendedPayload
      );
      const gpt = resp.data.prescription || {};

      setDiagnosis(gpt.diagnosis || "");

      if (Array.isArray(gpt.tests)) {
        const testStrings = gpt.tests.map((item) => {
          if (item && typeof item === "object") {
            const nm = item.name || "Unknown Test";
            const pp = item.purpose || "";
            return pp ? `${nm} (${pp})` : nm;
          }
          return String(item);
        });
        setTests(testStrings.join(", "));
      } else if (typeof gpt.tests === "string") {
        setTests(gpt.tests);
      }

      if (Array.isArray(gpt.drugs)) {
        const lines = gpt.drugs.map((item) => {
          if (item && typeof item === "object") {
            const nm = item.name || "Unknown";
            const st = item.strength || "";
            const fr = item.frequency || "";
            const du = item.duration || "";
            return `${nm} - ${st} (${fr}, ${du})`;
          }
          return String(item);
        });
        setDrugs(lines.join("\n"));
      } else if (typeof gpt.drugs === "string") {
        setDrugs(gpt.drugs);
      }

      if (gpt.follow_up) {
        setFollowUp(String(gpt.follow_up));
      }

      setSuccessMsg("Prescription generated!");
    } catch (err) {
      console.error("Error generating prescription:", err);
      setErrorMsg("Failed to generate prescription. Check logs or server.");
    } finally {
      setGeneratingPresc(false);
    }
  };

  const handleSaveAndDownloadPdf = async () => {
    setErrorMsg("");
    setSuccessMsg("");

    // GPT mode
    if (!manualMode) {
      if (!patientId) {
        setErrorMsg("Please load a patient or enter a valid ID first.");
        return;
      }
      setSavingPdf(true);
      try {
        const drugLines = drugs
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean);

        const testItems = tests
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);

        const payload = {
          patient_id: patientId,
          patient_name: patientName,
          diagnosis: diagnosis.trim(),
          drugs: drugLines,
          tests: testItems,
          follow_up: followUp.trim(),
          include_analysis: includeAnalysis,
          medical_imaging_analysis: hasMedicalImaging ? medicalImagingAnalysis : "",
          lab_report_analysis: hasLabReport ? labReportAnalysis : "",
          prescription_analysis: hasPrescription ? prescriptionAnalysis : "",
        };

        const resp = await axios.post(
          `${API_BASE_URL}/api/prescription/save`,
          payload
        );
        const pdfUrl = resp.data.pdf_url;
        if (!pdfUrl) {
          throw new Error("No pdf_url from server");
        }

        window.open(pdfUrl, "_blank");
        setSuccessMsg("Prescription PDF saved & downloaded!");
      } catch (err) {
        console.error("Error saving/downloading PDF:", err);
        setErrorMsg("Failed to save PDF. Check logs/S3 permissions.");
      } finally {
        setSavingPdf(false);
      }
      return;
    }

    // Manual mode
    let finalPatientName = manualPatientName.trim();
    if (!finalPatientName) {
      setErrorMsg("Please enter a patient name in Manual Mode.");
      return;
    }

    setSavingPdf(true);
    try {
      const drugLines = medicineTable
        .map((row) => {
          const { medicine, dosage, unit, when, duration, notes } = row;
          const lineParts = [];
          if (medicine) lineParts.push(medicine);
          if (dosage) lineParts.push(dosage);
          if (unit) lineParts.push(unit);
          if (when) lineParts.push(`(${when})`);
          if (duration) lineParts.push(`x ${duration}`);
          if (notes) lineParts.push(`Notes: ${notes}`);
          return lineParts.join(" ").trim();
        })
        .filter((x) => x.trim() !== "");

      const complaintStr = manualComplaints.join(", ");
      const testStr = manualTests.join(", ");

      const payload = {
        patient_id: patientId,
        patient_name: finalPatientName,
        diagnosis: manualDiagnosis.trim(),
        drugs: drugLines,
        tests: testStr ? testStr.split(",").map((x) => x.trim()) : [],
        follow_up: manualFollowUp.trim(),
        complaints: complaintStr,
        temperature: manualTemperature.trim(),
        bp: manualBP.trim(),
        pulse: manualPulse.trim(),
        bmi: manualBMI.trim(),
        medicineTable,
        patient_age: manualPatientAge.trim(),
        patient_gender: manualPatientGender.trim(),
        patient_contact: manualPatientContact.trim(),
        include_analysis: includeAnalysis,
        medical_imaging_analysis: hasMedicalImaging ? medicalImagingAnalysis : "",
        lab_report_analysis: hasLabReport ? labReportAnalysis : "",
        prescription_analysis: hasPrescription ? prescriptionAnalysis : "",
      };

      const resp = await axios.post(
        `${API_BASE_URL}/api/prescription/save`,
        payload
      );
      const pdfUrl = resp.data.pdf_url;
      if (!pdfUrl) {
        throw new Error("No pdf_url from server");
      }

      window.open(pdfUrl, "_blank");
      setSuccessMsg("Prescription PDF saved & downloaded!");
    } catch (err) {
      console.error("Error saving/downloading PDF (manual):", err);
      setErrorMsg("Failed to save PDF. Check logs/S3 permissions.");
    } finally {
      setSavingPdf(false);
    }
  };

  const handleToggleManualMode = () => {
    setManualMode(!manualMode);
    setErrorMsg("");
    setSuccessMsg("");
  };

  // Medicines search
  const loadMedicineOptions = async (inputValue) => {
    if (!inputValue) {
      return [];
    }
    try {
      const response = await axios.get(`${API_BASE_URL}/api/medicines`, {
        params: { query: inputValue },
      });
      const results = response.data || [];
      return results.map((item) => ({ label: item, value: item }));
    } catch (err) {
      console.error("Error fetching medicine list:", err);
      return [];
    }
  };

  const handleMedTableChange = (index, field, value) => {
    setMedicineTable((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (
        field === "medicine" &&
        index === updated.length - 1 &&
        value.trim().length > 0
      ) {
        updated.push({
          medicine: "",
          dosage: "",
          unit: "",
          when: "",
          duration: "",
          notes: "",
        });
      }
      return updated;
    });
  };

  const removeMedTableRow = (idx) => {
    setMedicineTable((prev) => {
      if (prev.length === 1) {
        return [
          {
            medicine: "",
            dosage: "",
            unit: "",
            when: "",
            duration: "",
            notes: "",
          },
        ];
      }
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSaveTemplate = () => {
    const templateName = window.prompt(
      "Enter a name for this prescription template:"
    );
    if (!templateName) return;
    if (!manualMode) {
      alert("Templates are only for Manual Mode prescriptions in this example.");
      return;
    }

    const templateData = {
      complaints: manualComplaints,
      temperature: manualTemperature,
      bp: manualBP,
      pulse: manualPulse,
      bmi: manualBMI,
      diagnosis: manualDiagnosis,
      followUp: manualFollowUp,
      tests: manualTests,
      medicineTable,
      medical_imaging_analysis: medicalImagingAnalysis,
      lab_report_analysis: labReportAnalysis,
      prescription_analysis: prescriptionAnalysis,
      include_analysis: includeAnalysis,
    };

    axios
      .post(`${API_BASE_URL}/api/prescription-template`, {
        name: templateName,
        template_data: templateData,
      })
      .then(() => {
        alert("Template saved successfully!");
        fetchTemplates();
      })
      .catch((err) => {
        console.error("Error saving prescription template:", err);
        alert("Failed to save template. Check console.");
      });
  };

  const fetchTemplates = () => {
    axios
      .get(`${API_BASE_URL}/api/prescription-templates`)
      .then((res) => {
        if (Array.isArray(res.data.templates)) {
          setTemplateList(res.data.templates);
        }
      })
      .catch((err) =>
        console.error("Error fetching prescription templates:", err)
      );
  };

  const handleCopyTemplate = () => {
    if (!manualMode) {
      alert("Copying templates is only for Manual Mode in this example.");
      return;
    }
    if (templateList.length === 0) {
      alert("No templates found. Please save one first.");
      return;
    }
    setShowTemplateSelector(true);
  };

  const handleTemplateSelect = (e) => {
    const selectedId = e.target.value;
    if (!selectedId) return;
    const template = templateList.find((t) => String(t.id) === selectedId);
    if (!template) return;

    const data = template.template_data;
    setManualComplaints(Array.isArray(data.complaints) ? data.complaints : []);
    setManualTemperature(data.temperature || "");
    setManualBP(data.bp || "");
    setManualPulse(data.pulse || "");
    setManualBMI(data.bmi || "");
    setManualDiagnosis(data.diagnosis || "");
    setManualFollowUp(data.followUp || "");
    setManualTests(Array.isArray(data.tests) ? data.tests : []);
    setMedicineTable(
      data.medicineTable || [
        {
          medicine: "",
          dosage: "",
          unit: "",
          when: "",
          duration: "",
          notes: "",
        },
      ]
    );
    if (data.hasOwnProperty("include_analysis")) {
      setIncludeAnalysis(data.include_analysis);
    }

    setShowTemplateSelector(false);
    alert(`Loaded template "${template.name}"!`);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const AnalysisContainer = () => {
    if (!hasMedicalImaging && !hasLabReport && !hasPrescription) {
      return null;
    }

    return (
      <div className="analysis-container">
        <div className="analysis-header-row">
          <h3 className="analysis-header">Analysis Reports</h3>
          <div className="include-checkbox">
            <input
              type="checkbox"
              id="include-analysis"
              checked={includeAnalysis}
              onChange={(e) => setIncludeAnalysis(e.target.checked)}
            />
            <label htmlFor="include-analysis">
              Include clinical analysis in prescription
            </label>
          </div>
        </div>

        {hasMedicalImaging && (
          <div className="form-group">
            <label>Medical Imaging Analysis:</label>
            {analyzingData ? (
              <div className="analyzing-indicator">Analyzing data...</div>
            ) : (
              <textarea
                rows="4"
                value={medicalImagingAnalysis}
                onChange={(e) => setMedicalImagingAnalysis(e.target.value)}
                placeholder="Medical imaging analysis details..."
              />
            )}
          </div>
        )}

        {hasLabReport && (
          <div className="form-group">
            <label>Lab Report Analysis:</label>
            {analyzingData ? (
              <div className="analyzing-indicator">Analyzing data...</div>
            ) : (
              <textarea
                rows="4"
                value={labReportAnalysis}
                onChange={(e) => setLabReportAnalysis(e.target.value)}
                placeholder="Lab report analysis details..."
              />
            )}
          </div>
        )}

        {hasPrescription && (
          <div className="form-group">
            <label>Previous Prescription Analysis:</label>
            {analyzingData ? (
              <div className="analyzing-indicator">Analyzing data...</div>
            ) : (
              <textarea
                rows="4"
                value={prescriptionAnalysis}
                onChange={(e) => setPrescriptionAnalysis(e.target.value)}
                placeholder="Previous prescription analysis details..."
              />
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="prescription-container fade-in">
      <h2 className="prescription-title">Prescription Writing</h2>

      {errorMsg && <div className="prescription-error">{errorMsg}</div>}
      {successMsg && <div className="prescription-success">{successMsg}</div>}

      {/* Toggle Manual Mode */}
      <div className="manual-toggle-row">
        <label className="manual-toggle-label">
          <input
            type="checkbox"
            checked={manualMode}
            onChange={handleToggleManualMode}
          />
          <span>Use Manual Mode</span>
        </label>
      </div>

      {/* Step A: Multi-field to load patient */}
      <div className="search-form" style={{ marginBottom: "1.2rem" }}>
        <div className="search-group">
          <label>Patient ID (optional):</label>
          <input
            type="text"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            placeholder="e.g. 101"
          />
        </div>
        <div className="search-group">
          <label>Name (optional):</label>
          <input
            type="text"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            placeholder="e.g. John"
          />
        </div>
        <div className="search-group">
          <label>Contact (optional):</label>
          <input
            type="text"
            value={searchContact}
            onChange={(e) => setSearchContact(e.target.value)}
            placeholder="e.g. 1234567890"
          />
        </div>
        <button
          className={`action-btn ${loadingPatient ? "loading" : ""}`}
          onClick={handleLoadPatientInfo}
          disabled={loadingPatient || generatingPresc || savingPdf}
          style={{ marginTop: "1.7rem" }}
        >
          {loadingPatient ? "Loading..." : "Load Patient Info"}
        </button>
      </div>

      {showMatches && searchMatches.length > 1 && (
        <div style={{ marginBottom: "1rem" }}>
          <p>Multiple matches found. Please pick one:</p>
          <ul className="patient-list" style={{ marginLeft: "1.2rem" }}>
            {searchMatches.map((p) => (
              <li key={p.id} style={{ marginBottom: "0.5rem" }}>
                <strong>ID:</strong> {p.id}, <strong>Name:</strong> {p.patient_name},{" "}
                <strong>Age:</strong> {p.age}, <strong>Gender:</strong> {p.gender},{" "}
                <strong>Contact:</strong> {p.contact_number}
                <br />
                <button
                  className="action-btn"
                  style={{ marginTop: "0.5rem" }}
                  onClick={() => handlePickMatch(p.id)}
                >
                  Choose This Patient
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* GPT-Powered Mode */}
      {!manualMode && !showMatches && (
        <>
          {patientName && (
            <p>
              <strong>Patient:</strong> {patientName} ({patientAge} y/o,{" "}
              {patientGender})
            </p>
          )}
          <hr />

          {/* Medical Analysis */}
          <AnalysisContainer />

          <div className="form-group">
            <label>Diagnosis:</label>
            <input
              type="text"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="e.g., Pneumonia"
            />
          </div>

          <div className="form-group">
            <label>Drugs & Dosages (one per line):</label>
            <textarea
              rows="4"
              value={drugs}
              onChange={(e) => setDrugs(e.target.value)}
              placeholder="Amoxicillin 500mg TID 7 days&#10;Paracetamol 500mg QID PRN"
            />
          </div>

          <div className="form-group">
            <label>Recommended Tests (comma-separated):</label>
            <textarea
              rows="2"
              value={tests}
              onChange={(e) => setTests(e.target.value)}
              placeholder="Blood Culture, Chest X-ray"
            />
          </div>

          <div className="form-group">
            <label>Follow-Up Instructions:</label>
            <textarea
              rows="2"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              placeholder="Return in 2 weeks."
            />
          </div>

          <div className="btn-row">
            <button
              className={`action-btn ${generatingPresc ? "loading" : ""}`}
              onClick={handleGeneratePrescription}
              disabled={loadingPatient || generatingPresc || savingPdf}
            >
              {generatingPresc ? "Generating..." : "Generate Prescription"}
            </button>

            <button
              className={`action-btn ${savingPdf ? "loading" : ""}`}
              onClick={handleSaveAndDownloadPdf}
              disabled={loadingPatient || generatingPresc || savingPdf}
            >
              {savingPdf ? "Saving..." : "Save & Download PDF"}
            </button>
          </div>
        </>
      )}

      {/* MANUAL MODE */}
      {manualMode && !showMatches && (
        <div className="manual-mode-section">
          <p className="manual-mode-hint">
            Fill in manual prescription details (or load patient info to
            auto-fill some fields).
          </p>

          {/* Row: Voice Mode toggle (IMPROVED UI) */}
          <div className="voice-mode-toggle-row">
            <span className="voice-mode-label">Voice Mode:</span>
            <label className="voice-toggle-switch">
              <input
                type="checkbox"
                checked={voiceMode}
                onChange={(e) => handleVoiceToggle(e.target.checked)}
              />
              <span className="voice-toggle-slider"></span>
            </label>

            {isRecording && !isProcessingAudio && (
              <div className="recording-wave">
                <span className="wave-dot" />
                <span className="wave-dot" />
                <span className="wave-dot" />
                <span style={{ marginLeft: "6px" }}>Recording...</span>
              </div>
            )}
            {isProcessingAudio && (
              <div className="audio-processing-spinner">
                Transcribing...
              </div>
            )}
          </div>

          {/* Row: Name + Age */}
          <div className="form-row">
            <div className="form-group col">
              <label>Patient Name:</label>
              <input
                type="text"
                value={manualPatientName}
                onChange={(e) => setManualPatientName(e.target.value)}
                placeholder="e.g. John Doe"
              />
            </div>
            <div className="form-group col">
              <label>Patient Age:</label>
              <input
                type="number"
                value={manualPatientAge}
                onChange={(e) => setManualPatientAge(e.target.value)}
                placeholder="e.g. 40"
              />
            </div>
          </div>

          {/* Row: Gender + Contact */}
          <div className="form-row">
            <div className="form-group col">
              <label>Gender:</label>
              <select
                value={manualPatientGender}
                onChange={(e) => setManualPatientGender(e.target.value)}
              >
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </div>
            <div className="form-group col">
              <label>Contact:</label>
              <input
                type="text"
                value={manualPatientContact}
                onChange={(e) => setManualPatientContact(e.target.value)}
                placeholder="e.g. 9998887777"
              />
            </div>
          </div>

          <hr />

          {/* Medical Analysis */}
          <AnalysisContainer />

          {/* Complaints (multi) */}
          <div className="form-group">
            <label>Complaints:</label>
            <CreatableSelect
              isMulti
              placeholder="e.g. Fever, Cough..."
              value={manualComplaints.map((val) => ({ label: val, value: val }))}
              options={complaintSuggestions.map((cs) => ({
                label: cs,
                value: cs,
              }))}
              onChange={(selected) =>
                setManualComplaints(selected ? selected.map((s) => s.value) : [])
              }
              menuPortalTarget={document.body}
              classNamePrefix="react-select"
            />
          </div>

          <h5 className="vitals-header">Vitals</h5>
          <div className="form-row">
            <div className="form-group col">
              <label>Temperature (°C)</label>
              <input
                type="text"
                value={manualTemperature}
                onChange={(e) => setManualTemperature(e.target.value)}
                placeholder="e.g. 37.2"
              />
            </div>
            <div className="form-group col">
              <label>BP</label>
              <input
                type="text"
                value={manualBP}
                onChange={(e) => setManualBP(e.target.value)}
                placeholder="e.g. 120/80"
              />
            </div>
            <div className="form-group col">
              <label>Pulse (bpm)</label>
              <input
                type="text"
                value={manualPulse}
                onChange={(e) => setManualPulse(e.target.value)}
                placeholder="e.g. 72"
              />
            </div>
            <div className="form-group col">
              <label>BMI</label>
              <input
                type="text"
                value={manualBMI}
                onChange={(e) => setManualBMI(e.target.value)}
                placeholder="e.g. 24.5"
              />
            </div>
          </div>

          {/* Diagnosis (multi) */}
          <div className="form-group">
            <label>Diagnosis:</label>
            <CreatableSelect
              isMulti
              placeholder="Type or select diagnoses..."
              value={manualDiagnosis
                .split(",")
                .map((d) => d.trim())
                .filter(Boolean)
                .map((val) => ({ label: val, value: val }))}
              options={diagnosisSuggestions.map((ds) => ({ label: ds, value: ds }))}
              onChange={(selected) => {
                const joined = selected
                  ? selected.map((s) => s.value).join(", ")
                  : "";
                setManualDiagnosis(joined);
              }}
              menuPortalTarget={document.body}
              classNamePrefix="react-select"
            />
          </div>

          <label className="medicines-label">
            Medicines (Name | Dosage | Unit | When | Duration | Notes)
          </label>

          <div className="medicine-table-wrapper">
            <table className="medicine-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Dosage</th>
                  <th>Unit</th>
                  <th>When</th>
                  <th>Duration</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {medicineTable.map((row, idx) => {
                  const showRemove = idx < medicineTable.length || row.medicine;
                  return (
                    <tr key={idx}>
                      <td>
                        <AsyncCreatableSelect
                          classNamePrefix="react-select"
                          isClearable
                          placeholder="e.g. Amoxicillin"
                          value={
                            row.medicine
                              ? { label: row.medicine, value: row.medicine }
                              : null
                          }
                          loadOptions={loadMedicineOptions}
                          defaultOptions={[]}
                          onChange={(sel) =>
                            handleMedTableChange(idx, "medicine", sel ? sel.value : "")
                          }
                          onCreateOption={(newVal) =>
                            handleMedTableChange(idx, "medicine", newVal)
                          }
                          menuPortalTarget={document.body}
                        />
                      </td>
                      <td>
                        <CreatableSelect
                          classNamePrefix="react-select"
                          isClearable
                          placeholder="e.g. 1-0-1"
                          value={
                            row.dosage ? { label: row.dosage, value: row.dosage } : null
                          }
                          options={dosageSuggestions.map((d) => ({
                            label: d,
                            value: d,
                          }))}
                          onChange={(sel) =>
                            handleMedTableChange(idx, "dosage", sel ? sel.value : "")
                          }
                          onCreateOption={(newVal) =>
                            handleMedTableChange(idx, "dosage", newVal)
                          }
                          menuPortalTarget={document.body}
                        />
                      </td>
                      <td>
                        <CreatableSelect
                          classNamePrefix="react-select"
                          isClearable
                          placeholder="e.g. mg"
                          value={row.unit ? { label: row.unit, value: row.unit } : null}
                          options={unitSuggestions.map((u) => ({
                            label: u,
                            value: u,
                          }))}
                          onChange={(sel) =>
                            handleMedTableChange(idx, "unit", sel ? sel.value : "")
                          }
                          onCreateOption={(newVal) =>
                            handleMedTableChange(idx, "unit", newVal)
                          }
                          menuPortalTarget={document.body}
                        />
                      </td>
                      <td>
                        <CreatableSelect
                          classNamePrefix="react-select"
                          isClearable
                          placeholder="e.g. Before Food"
                          value={row.when ? { label: row.when, value: row.when } : null}
                          options={whenSuggestions.map((w) => ({
                            label: w,
                            value: w,
                          }))}
                          onChange={(sel) =>
                            handleMedTableChange(idx, "when", sel ? sel.value : "")
                          }
                          onCreateOption={(newVal) =>
                            handleMedTableChange(idx, "when", newVal)
                          }
                          menuPortalTarget={document.body}
                        />
                      </td>
                      <td>
                        <CreatableSelect
                          classNamePrefix="react-select"
                          isClearable
                          placeholder="e.g. 7 days"
                          value={
                            row.duration
                              ? { label: row.duration, value: row.duration }
                              : null
                          }
                          options={durationSuggestions.map((du) => ({
                            label: du,
                            value: du,
                          }))}
                          onChange={(sel) =>
                            handleMedTableChange(idx, "duration", sel ? sel.value : "")
                          }
                          onCreateOption={(newVal) =>
                            handleMedTableChange(idx, "duration", newVal)
                          }
                          menuPortalTarget={document.body}
                        />
                      </td>
                      <td>
                        <CreatableSelect
                          classNamePrefix="react-select"
                          isClearable
                          placeholder="Any notes..."
                          value={row.notes ? { value: row.notes } : null}
                          options={TU}
                          onChange={(selected) => {
                            handleMedTableChange(
                              idx,
                              "notes",
                              selected ? selected.value : ""
                            );
                          }}
                          onCreateOption={(newVal) => {
                            handleMedTableChange(idx, "notes", newVal);
                          }}
                          getOptionLabel={(option) => option.value}
                          getOptionValue={(option) => option.value}
                          menuPortalTarget={document.body}
                        />
                      </td>
                      <td>
                        {showRemove && (
                          <button
                            type="button"
                            className="remove-row-btn"
                            onClick={() => removeMedTableRow(idx)}
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

          {/* Tests (multi) */}
          <div className="form-group">
            <label>Tests:</label>
            <CreatableSelect
              isMulti
              placeholder="Type or select tests..."
              value={manualTests.map((val) => ({ label: val, value: val }))}
              options={testSuggestions.map((ts) => ({ label: ts, value: ts }))}
              onChange={(selected) =>
                setManualTests(selected ? selected.map((s) => s.value) : [])
              }
              menuPortalTarget={document.body}
              classNamePrefix="react-select"
            />
          </div>

          <div className="form-group">
            <label>Follow-Up Instructions:</label>
            <textarea
              rows="2"
              value={manualFollowUp}
              onChange={(e) => setManualFollowUp(e.target.value)}
              placeholder="Return in 2 weeks."
            />
          </div>

          {/* Template Buttons */}
          <div className="template-btn-row">
            <button type="button" className="template-btn" onClick={handleSaveTemplate}>
              Save as Template
            </button>
            <button type="button" className="template-btn" onClick={handleCopyTemplate}>
              Load from Template
            </button>
            {showTemplateSelector && (
              <div className="template-select">
                <select onChange={handleTemplateSelect} defaultValue="">
                  <option value="">-- Select a Template --</option>
                  {templateList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Save & Download PDF (Manual) */}
          <div className="btn-row">
            <button
              className={`action-btn ${savingPdf ? "loading" : ""}`}
              onClick={handleSaveAndDownloadPdf}
              disabled={loadingPatient || generatingPresc || savingPdf}
            >
              {savingPdf ? "Saving..." : "Save & Download PDF"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrescriptionWriting;