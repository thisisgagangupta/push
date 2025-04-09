import React, { useEffect, useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  Clock,
  User,
  Activity,
  ChevronRight,
  PlusCircle,
  XCircle,
  Filter,
} from "lucide-react";

interface Appointment {
  id?: number;
  appointment_time?: string; 
  patient_name: string;
  patient_id?: string; 
  service_name?: string;
  doctor_name?: string;
}

interface AppointmentsResponse {
  date: string;
  appointments: Appointment[];
}

interface Clinic {
  id: number;
  name: string;
}
interface Doctor {
  id: number;
  name: string;
  speciality: string;
  contact_number?: string;
  clinic_id: number;
}

interface BillItem {
  id: number;
  service_id: number;
  doctor_id: number;
  appointment_date: string;
  appointment_time: string;
  duration?: number;
  price: number;
  discount: number;
  net_amount: number;
}

interface Bill {
  id: number;
  patient_id: number;
  bill_date: string;
  payment_mode: string;
  payment_status: string;
  total_amount: number;
  items: BillItem[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const AppointmentsPage: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [todayDate, setTodayDate] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>("");
  const [newAge, setNewAge] = useState<string>("");
  const [newGender, setNewGender] = useState<string>("Male");
  const [newContact, setNewContact] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [newDoctor, setNewDoctor] = useState<string>("");
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<number | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [showClinicPanel, setShowClinicPanel] = useState(false);
  const [showBillsModal, setShowBillsModal] = useState(false);
  const [billsForPatient, setBillsForPatient] = useState<Bill[]>([]); 
  const [selectedPatientIdForBills, setSelectedPatientIdForBills] = useState<string | null>(null);
  const [showRxModal, setShowRxModal] = useState(false);
  const [rxUrl, setRxUrl] = useState<string>("");
  const [billsLoading, setBillsLoading] = useState(false);
  const [rxLoading, setRxLoading] = useState(false);

  useEffect(() => {
    fetchTodayAppointments();
    // NEW CODE: also load list of clinics
    fetchClinics();
    // END NEW CODE
  }, []);

  // NEW CODE: load clinics
  async function fetchClinics() {
    try {
      const resp = await fetch(`${API_BASE_URL}/api/clinics`);
      if (!resp.ok) {
        throw new Error("Failed to fetch clinics");
      }
      const data = await resp.json();
      setClinics(data);
    } catch (err) {
      console.error("Error fetching clinics:", err);
    }
  }

  // load doctors by clinic
  async function fetchDoctorsByClinic(clinicId: number) {
    try {
      const resp = await fetch(`${API_BASE_URL}/api/doctors?clinic_id=${clinicId}`);
      if (!resp.ok) {
        throw new Error("Failed to fetch doctors for clinic");
      }
      const data = await resp.json();
      setDoctors(data);
    } catch (err) {
      console.error("Error fetching doctors:", err);
    }
  }

  // If no clinic is selected, we fetch all doctors
  async function fetchAllDoctors() {
    try {
      const resp = await fetch(`${API_BASE_URL}/api/doctors`);
      if (!resp.ok) {
        throw new Error("Failed to fetch doctors");
      }
      const data = await resp.json();
      setDoctors(data);
    } catch (err) {
      console.error("Error fetching all doctors:", err);
    }
  }

  async function fetchTodayAppointments() {
    setLoading(true);
    setErrorMsg("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/appointments/today`);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data: AppointmentsResponse = await response.json();
      setTodayDate(data.date || "");
      setAppointments(data.appointments || []);
    } catch (err) {
      console.error("Error fetching appointments:", err);
      setErrorMsg("Failed to load today's appointments.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchAppointmentsForDate(dateStr: string) {
    setLoading(true);
    setErrorMsg("");

    try {
      let url = `${API_BASE_URL}/api/appointments?date=${dateStr}`;
      if (selectedDoctorId) {
        url += `&doctor_id=${selectedDoctorId}`;
      } else if (selectedClinicId) {
        url += `&clinic_id=${selectedClinicId}`;
      }
      // END NEW CODE

      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error("Network response was not ok");
      }
      const data: AppointmentsResponse = await resp.json();
      setTodayDate(dateStr);
      setAppointments(data.appointments || []);
    } catch (err) {
      console.error("Error fetching appointments by date:", err);
      setErrorMsg("Could not fetch appointments for the selected date.");
    } finally {
      setLoading(false);
    }
  }

  // Handle opening/closing the "Create Appointment" modal
  const handleOpenCreateModal = () => {
    // Reset fields
    setNewName("");
    setNewAge("");
    setNewGender("Male");
    setNewContact("");
    setSelectedDate("");
    setSelectedTime("");
    setAvailableTimes([]);
    setNewDoctor(""); // NEW
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
  };

  // Whenever selectedDate changes, fetch existing appointments for that date
  useEffect(() => {
    if (!selectedDate) {
      setAvailableTimes([]);
      return;
    }
    fetchAvailableTimes(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  async function fetchAvailableTimes(dateStr: string) {
    try {
      let url = `${API_BASE_URL}/api/appointments?date=${dateStr}`;
      // also apply clinic/doctor if you want those times to reflect the same filter
      if (selectedDoctorId) {
        url += `&doctor_id=${selectedDoctorId}`;
      } else if (selectedClinicId) {
        url += `&clinic_id=${selectedClinicId}`;
      }

      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error("Failed to fetch appointments for selected date");
      }
      const data: AppointmentsResponse = await resp.json();
      const bookedTimes = data.appointments.map((appt) =>
        appt.appointment_time?.slice(0, 5)
      );

      const allSlots = generateTimeSlots("09:00", "17:00", 30);
      const freeSlots = allSlots.filter((slot) => !bookedTimes.includes(slot));
      setAvailableTimes(freeSlots);
    } catch (error) {
      console.error("Error fetching date-based appointments:", error);
      setErrorMsg("Could not fetch slots for this date.");
    }
  }

  function generateTimeSlots(start: string, end: string, intervalMin: number) {
    const slots: string[] = [];
    let [startH, startM] = start.split(":").map(Number);
    let [endH, endM] = end.split(":").map(Number);

    let startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    while (startTotal <= endTotal) {
      const hours = Math.floor(startTotal / 60);
      const mins = startTotal % 60;
      slots.push(`${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`);
      startTotal += intervalMin;
    }
    return slots;
  }

  async function handleCreateAppointment(e: FormEvent) {
    e.preventDefault();
    if (!newName || !newAge || !newContact || !selectedDate || !selectedTime) {
      alert("Please fill all required fields");
      return;
    }

    try {
      const payload = {
        patient_name: newName,
        age: Number(newAge),
        gender: newGender,
        contact_number: newContact,
        appointment_date: selectedDate,
        appointment_time: selectedTime + ":00",
        consultant_doctor: newDoctor,
      };

      const resp = await fetch(`${API_BASE_URL}/api/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Failed to create appointment: ${txt}`);
      }

      handleCloseCreateModal();
      if (todayDate) {
        fetchAppointmentsForDate(todayDate);
      } else {
        fetchTodayAppointments();
      }
    } catch (error) {
      console.error("Error creating appointment:", error);
      setErrorMsg("Could not create the appointment. Please try again.");
    }
  }

  const handleStartVisit = (appointmentId?: string) => {
    alert(`Start Visit for appointment ID = ${appointmentId} (or patient ID if you track that).`);
  };

  const handleToggleClinicPanel = () => {
    setShowClinicPanel((prev) => !prev);
  };

  const handleSelectClinic = (clinicIdStr: string) => {
    const cid = clinicIdStr ? parseInt(clinicIdStr) : null;
    setSelectedClinicId(cid);
    setSelectedDoctorId(null); // reset doctor
    if (cid) {
      fetchDoctorsByClinic(cid);
    } else {
      setDoctors([]);
    }
  };

  useEffect(() => {
    if (!selectedClinicId) {
      // If no clinic is chosen, fetch all doctors to populate the typeahead as well
      fetchAllDoctors();
    }
    if (todayDate) {
      fetchAppointmentsForDate(todayDate);
    }
  }, [selectedClinicId, selectedDoctorId]);

  const totalAppointments = appointments.length;
  const uniquePatients = new Set(appointments.map((a) => a.patient_id || a.patient_name)).size;

  async function handleViewBills(patientId?: string) {
    if (!patientId) return;
    setSelectedPatientIdForBills(patientId);
    setBillsLoading(true);
    setShowBillsModal(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/patients/${patientId}/bills`);
      if (!resp.ok) {
        throw new Error(`Failed to load bills for patient ${patientId}`);
      }
      const data: Bill[] = await resp.json(); // typed as Bill[]
      setBillsForPatient(data);
    } catch (e) {
      console.error("Error fetching bills:", e);
      setErrorMsg("Could not load bills for this patient.");
    } finally {
      setBillsLoading(false);
    }
  }

  async function handleViewRx(patientId?: string) {
    if (!patientId) return;
    setRxLoading(true);
    setShowRxModal(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/patient/${patientId}`);
      if (!resp.ok) {
        throw new Error("Failed to load patient to get Rx");
      }
      const patientData = await resp.json();
      if (!patientData || !patientData.generated_prescription_url) {
        alert("No prescription found for this patient");
        setShowRxModal(false);
        return;
      }
      const encodedUrl = encodeURIComponent(patientData.generated_prescription_url);
      const previewResp = await fetch(`${API_BASE_URL}/api/file-preview?file_url=${encodedUrl}`);
      if (!previewResp.ok) {
        throw new Error("Failed to get presigned URL for prescription PDF");
      }
      const previewData = await previewResp.json();
      setRxUrl(previewData.presigned_url);
    } catch (e) {
      console.error("Error fetching prescription:", e);
      setErrorMsg("Could not load prescription PDF.");
    } finally {
      setRxLoading(false);
    }
  }

  // A simple spinner component used in modals
  const Spinner: React.FC<{ color?: string }> = ({ color = "#000" }) => (
    <svg
      className="animate-spin h-6 w-6"
      style={{ color }}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8H4z"
      />
    </svg>
  );

  return (
    <div className="min-h-screen flex flex-col w-screen bg-background p-4">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 text-foreground">
              <div className="relative size-8 overflow-hidden rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-medium text-lg">M</span>
              </div>
              <span className="font-medium text-lg tracking-tight hidden sm:block">
                MedMitra
              </span>
            </Link>
            <div className="hidden md:flex">
              <div className="h-6 w-px bg-border/60 mx-3" />
              <h1 className="text-lg font-medium tracking-tight">Appointments</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Manage Clinics button */}
            <button
              onClick={handleToggleClinicPanel}
              className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Filter className="mr-1 h-4 w-4" />
              {showClinicPanel ? "Hide Filters" : "Manage Clinics"}
            </button>
            {/* Create Appointment Button */}
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <PlusCircle className="mr-1 h-4 w-4" />
              Create Appointment
            </button>

            <Link
              to="/pharmacy"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-black shadow transition-colors hover:bg-primary/90"
            >
              Pharmacy
            </Link>

            <Link
              to="/report"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-black shadow transition-colors hover:bg-primary/90"
            >
              Report
            </Link>

            <Link
              to="/home"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-black shadow transition-colors hover:bg-primary/90"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* NEW CODE: Collapsible Clinic/Doctor Filter Panel */}
      <div
        className={`transform transition-all duration-300 ${
          showClinicPanel ? "opacity-100 max-h-[400px] mt-4" : "opacity-0 max-h-0"
        } overflow-hidden`}
      >
        {showClinicPanel && (
          <div className="p-4 rounded bg-white border border-gray-200 w-full max-w-3xl shadow-sm mx-auto mb-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold text-gray-700">Filter by Clinic / Doctor</h2>
              <button
                onClick={handleToggleClinicPanel}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <hr className="mb-4" />

            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="w-full md:w-1/2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Clinic
                </label>
                <select
                  value={selectedClinicId || ""}
                  onChange={(e) => handleSelectClinic(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="">All Clinics</option>
                  {clinics.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full md:w-1/2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Doctor
                </label>
                <select
                  value={selectedDoctorId || ""}
                  onChange={(e) =>
                    setSelectedDoctorId(e.target.value ? parseInt(e.target.value) : null)
                  }
                  className="w-full p-2 border rounded"
                  disabled={!selectedClinicId}
                >
                  <option value="">All Doctors</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* END NEW CODE */}

      <main className="flex-1">
        <div className="w-full">
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-1 animate-fade-in">
              Today's Appointments
            </h1>
            <p
              className="text-muted-foreground animate-fade-in"
              style={{ animationDelay: "100ms" }}
            >
              Manage your patient visits efficiently
            </p>
          </div>

          {/* Analytics row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div
              className="bg-card rounded-lg border border-border/50 p-5 shadow-sm animate-slide-in-bottom"
              style={{ animationDelay: "150ms" }}
            >
              <div className="flex items-start">
                <div className="mr-4 rounded-md bg-primary/10 p-2">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date</p>
                  <h3 className="mt-1 text-lg font-medium">{todayDate}</h3>
                </div>

                <div className="ml-auto flex items-center space-x-2">
                  <span role="img" aria-label="Calendar">
                    📅
                  </span>
                  <input
                    type="date"
                    value={todayDate}
                    onChange={(e) => fetchAppointmentsForDate(e.target.value)}
                    className="border rounded px-2 py-1 text-sm focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div
              className="bg-card rounded-lg border border-border/50 p-5 shadow-sm animate-slide-in-bottom"
              style={{ animationDelay: "200ms" }}
            >
              <div className="flex items-start">
                <div className="mr-4 rounded-md bg-primary/10 p-2">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Appointments
                  </p>
                  <h3 className="mt-1 text-lg font-medium">{appointments.length}</h3>
                </div>
              </div>
            </div>

            <div
              className="bg-card rounded-lg border border-border/50 p-5 shadow-sm animate-slide-in-bottom"
              style={{ animationDelay: "250ms" }}
            >
              <div className="flex items-start">
                <div className="mr-4 rounded-md bg-primary/10 p-2">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Unique Patients
                  </p>
                  <h3 className="mt-1 text-lg font-medium">
                    {uniquePatients}
                  </h3>
                </div>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="rounded-md bg-destructive/10 p-4 mb-8 animate-fade-in">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Activity className="h-5 w-5 text-destructive" aria-hidden="true" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-destructive">Error</h3>
                  <div className="mt-2 text-sm text-destructive/90">
                    <p>{errorMsg}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="rounded-lg border border-border/50 bg-card animate-pulse">
              <div className="p-6 space-y-4">
                <div className="h-6 bg-muted rounded w-1/4"></div>
                <div className="space-y-3">
                  <div className="grid grid-cols-5 gap-4">
                    <div className="h-4 bg-muted rounded col-span-1"></div>
                    <div className="h-4 bg-muted rounded col-span-1"></div>
                    <div className="h-4 bg-muted rounded col-span-1"></div>
                    <div className="h-4 bg-muted rounded col-span-1"></div>
                    <div className="h-4 bg-muted rounded col-span-1"></div>
                  </div>
                  {[...Array(4)].map((_, index) => (
                    <div key={index} className="grid grid-cols-5 gap-4">
                      <div className="h-8 bg-muted rounded col-span-1"></div>
                      <div className="h-8 bg-muted rounded col-span-1"></div>
                      <div className="h-8 bg-muted rounded col-span-1"></div>
                      <div className="h-8 bg-muted rounded col-span-1"></div>
                      <div className="h-8 bg-muted rounded col-span-1"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : appointments.length === 0 ? (
            <div className="rounded-lg border border-border/50 bg-card p-12 text-center animate-fade-in">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Calendar className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-medium">No appointments</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                There are no scheduled appointments for the current filter/date.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border/50 bg-card overflow-hidden shadow-sm animate-fade-in">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Patient
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Service
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Doctor
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {appointments.map((appt, idx) => {
                      const timeStr = appt.appointment_time
                        ? appt.appointment_time.slice(0, 5)
                        : "--:--";
                      const animationDelay = `${idx * 50 + 300}ms`;
                      return (
                        <tr
                          key={idx}
                          className="hover:bg-muted/30 transition-colors animate-fade-in-right"
                          style={{ animationDelay }}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center">
                              <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                              <span>{timeStr}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-primary font-medium text-sm">
                                  {appt.patient_name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")}
                                </span>
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium">
                                  {appt.patient_name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  ID: {appt.patient_id || appt.id}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {appt.service_name || "Consultation"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {appt.doctor_name || "Dr. John"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <div className="flex items-center justify-end gap-2">
                              {/* Original "Start Visit" */}
                              <button
                                onClick={() =>
                                  handleStartVisit(appt.patient_id?.toString())
                                }
                                className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
                              >
                                Start Visit
                                <ChevronRight className="ml-1 -mr-0.5 h-4 w-4" />
                              </button>
                              {/* NEW CODE: Bills, Rx buttons styled in purple */}
                              <button
                                onClick={() => handleViewBills(appt.patient_id?.toString())}
                                className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-white bg-[#7E57C2] shadow-sm hover:bg-[#7E57C2]/90"
                              >
                                Bills
                              </button>
                              <button
                                onClick={() => handleViewRx(appt.patient_id?.toString())}
                                className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-white bg-[#7E57C2] shadow-sm hover:bg-[#7E57C2]/90"
                              >
                                Rx
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* CREATE APPOINTMENT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
            <button
              onClick={handleCloseCreateModal}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
            <h2 className="text-xl font-semibold mb-4">Create Appointment</h2>

            <form className="space-y-4" onSubmit={handleCreateAppointment}>
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Age</label>
                <input
                  type="number"
                  placeholder="30"
                  value={newAge}
                  onChange={(e) => setNewAge(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Gender</label>
                <select
                  value={newGender}
                  onChange={(e) => setNewGender(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Contact</label>
                <input
                  type="text"
                  placeholder="9876543210"
                  value={newContact}
                  onChange={(e) => setNewContact(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Consultant Doctor</label>
                <input
                  type="text"
                  list="doctorList"
                  placeholder="Select or type doctor name..."
                  value={newDoctor}
                  onChange={(e) => setNewDoctor(e.target.value)}
                  className="w-full p-2 border rounded"
                />
                <datalist id="doctorList">
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.name}>
                      {doc.name} - {doc.speciality}
                    </option>
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input
                  type="date"
                  placeholder="YYYY-MM-DD"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              {selectedDate && (
                <div>
                  <label className="block text-sm font-medium mb-1">Time</label>
                  <select
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full p-2 border rounded"
                    required
                  >
                    <option value="">Select a timeslot</option>
                    {availableTimes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseCreateModal}
                  className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-primary text-white hover:bg-primary/90"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW CODE: Bills Preview Modal */}
      {showBillsModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6 relative">
            <button
              onClick={() => setShowBillsModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
            <h2 className="text-xl font-semibold mb-4">
              Bills for Patient {selectedPatientIdForBills}
            </h2>

            {billsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Spinner color="#7E57C2" />
                <span className="ml-2 text-sm text-gray-600">Loading bills...</span>
              </div>
            ) : billsForPatient.length === 0 ? (
              <p>No bills found.</p>
            ) : (
              billsForPatient.map((bill: Bill) => (
                <div key={bill.id} className="border rounded p-3 mb-4">
                  <div className="flex justify-between">
                    <div>
                      <div className="font-medium">Bill ID: {bill.id}</div>
                      <div className="text-sm text-gray-500">
                        Date: {bill.bill_date}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm">
                        Payment Mode: {bill.payment_mode}
                      </div>
                      <div className="text-sm">
                        Status: {bill.payment_status}
                      </div>
                      <div className="font-medium text-right">
                        Total: ₹{bill.total_amount}
                      </div>
                    </div>
                  </div>
                  {/* Bill items table */}
                  <table className="w-full mt-3 border text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-2 py-1 border">Service</th>
                        <th className="px-2 py-1 border">Doctor</th>
                        <th className="px-2 py-1 border">Price</th>
                        <th className="px-2 py-1 border">Discount</th>
                        <th className="px-2 py-1 border">Net</th>
                        <th className="px-2 py-1 border">Appt Date</th>
                        <th className="px-2 py-1 border">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bill.items.map((item: BillItem) => (
                        <tr key={item.id}>
                          <td className="px-2 py-1 border">{item.service_id}</td>
                          <td className="px-2 py-1 border">{item.doctor_id}</td>
                          <td className="px-2 py-1 border">{item.price}</td>
                          <td className="px-2 py-1 border">{item.discount}%</td>
                          <td className="px-2 py-1 border">{item.net_amount}</td>
                          <td className="px-2 py-1 border">{item.appointment_date}</td>
                          <td className="px-2 py-1 border">{item.appointment_time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showRxModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl p-6 relative">
            <button
              onClick={() => setShowRxModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
            <h2 className="text-xl font-semibold mb-4">Prescription Preview</h2>

            {rxLoading ? (
              <div className="flex items-center justify-center py-6">
                <Spinner color="#7E57C2" />
                <span className="ml-2 text-sm text-gray-600">Loading prescription...</span>
              </div>
            ) : rxUrl ? (
              <div className="h-[75vh] overflow-auto">
                <iframe
                  src={rxUrl}
                  width="100%"
                  height="100%"
                  title="Prescription Preview"
                />
              </div>
            ) : (
              <p>No prescription found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentsPage;
