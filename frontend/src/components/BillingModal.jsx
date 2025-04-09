import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  X,
  Plus,
  Trash2,
  BadgeIndianRupee,
  IndianRupee,
  PlusCircle,
  Printer,
  Loader2,
  Save,
  FileDown,
} from "lucide-react";
import { Link } from "react-router-dom";
import BillingMobileView from "./BillingMobileView";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const BillingModal = ({
  visible = false,
  close,
  pid,
  patientInfo: initialPatientInfo,
}) => {
  const [patientInfo, setPatientInfo] = useState({
    name: "",
    age: "",
    gender: "",
    phone: "",
  });
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientError, setPatientError] = useState(null);

  const [services, setServices] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [isClosing, setIsClosing] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const printFrameRef = useRef(null);

  useEffect(() => {
    if (!visible || !pid) return;

    // If we already have patient info from props, use that:
    if (
      initialPatientInfo &&
      initialPatientInfo.name &&
      initialPatientInfo.age &&
      initialPatientInfo.gender &&
      initialPatientInfo.phone
    ) {
      setPatientInfo({
        name: initialPatientInfo.name,
        age: initialPatientInfo.age,
        gender: initialPatientInfo.gender,
        phone: initialPatientInfo.phone,
      });
      return;
    }

    // Otherwise, fetch from /api/patient/{pid}/detailed
    const fetchPatientInfo = async () => {
      setPatientLoading(true);
      setPatientError(null);

      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/patient/${pid}/detailed`
        );
        const data = response.data;

        setPatientInfo({
          name: data.patient_name,
          age: data.age,
          gender: data.gender,
          phone: data.contact_number,
        });
      } catch (err) {
        console.error("Error fetching patient info:", err);
        setPatientError(
          "Failed to load patient information. Please try again."
        );
      } finally {
        setPatientLoading(false);
      }
    };

    fetchPatientInfo();
  }, [visible, pid, initialPatientInfo]);

  useEffect(() => {
    const fetchData = async () => {
      if (!visible) return;
      setLoading(true);
      try {
        const [servicesResponse, doctorsResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/services`),
          axios.get(`${API_BASE_URL}/api/doctors`),
        ]);

        const fetchedServices = servicesResponse.data || [];
        const fetchedDoctors = doctorsResponse.data || [];

        setServices(fetchedServices);
        setDoctors(fetchedDoctors);

        // Initialize rows with a single row by default
        if (fetchedServices.length > 0 && fetchedDoctors.length > 0) {
          setRows([
            {
              service: fetchedServices[0].name || "",
              price: fetchedServices[0].default_price || 0,
              discount: 0,
              doctor: fetchedDoctors[0].name || "",
              // If requires_time, set a default date/time, else blank
              appointmentDate: fetchedServices[0].requires_time
                ? new Date().toISOString().split("T")[0]
                : "",
              appointmentTime: fetchedServices[0].requires_time ? "10:00" : "",
              duration: fetchedServices[0].requires_time ? 30 : 0,
            },
          ]);
        } else {
          setRows([
            {
              service: "",
              price: 0,
              discount: 0,
              doctor: "",
              appointmentDate: "",
              appointmentTime: "",
              duration: 0,
            },
          ]);
        }
        setError(null);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load services or doctors. Please try again later.");
        setRows([
          {
            service: "",
            price: 0,
            discount: 0,
            doctor: "",
            appointmentDate: "",
            appointmentTime: "",
            duration: 0,
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [visible]);

  const resetForm = () => {
    // Clear everything
    if (services.length > 0 && doctors.length > 0) {
      setRows([
        {
          service: services[0].name,
          price: services[0].default_price || 0,
          discount: 0,
          doctor: doctors[0].name,
          appointmentDate: services[0].requires_time
            ? new Date().toISOString().split("T")[0]
            : "",
          appointmentTime: services[0].requires_time ? "10:00" : "",
          duration: services[0].requires_time ? 30 : 0,
        },
      ]);
    } else {
      setRows([
        {
          service: "",
          price: 0,
          discount: 0,
          doctor: "",
          appointmentDate: "",
          appointmentTime: "",
          duration: 0,
        },
      ]);
    }
    setPaymentMode("cash");
    setPaymentStatus("paid");
    setPdfUrl(null);
    setSuccessMessage(null);
  };

  const handleClose = () => {
    setIsClosing(true);
    resetForm();
    setTimeout(() => {
      close();
      setIsClosing(false);
    }, 300);
  };

  // MAIN CHANGE: When user changes service, if requires_time = true => set default date/time,
  // else clear them out so it won't appear in the queue.
  const handleServiceChange = (index, newServiceName) => {
    const selectedService = services.find((s) => s.name === newServiceName);
    if (!selectedService) return;

    setRows((prevRows) => {
      const updatedRows = [...prevRows];
      const requiresTime = selectedService.requires_time === true;

      updatedRows[index] = {
        ...updatedRows[index],
        service: newServiceName,
        price: selectedService.default_price || 0,
        // If the new service requires time, set default appointment info
        appointmentDate: requiresTime
          ? new Date().toISOString().split("T")[0]
          : "",
        appointmentTime: requiresTime ? "10:00" : "",
        duration: requiresTime ? 30 : 0,
      };
      return updatedRows;
    });
  };

  const handlePriceChange = (index, newPrice) => {
    setRows((prevRows) => {
      const updatedRows = [...prevRows];
      updatedRows[index] = {
        ...updatedRows[index],
        price: parseFloat(newPrice) || 0,
      };
      return updatedRows;
    });
  };

  const handleDiscountChange = (index, newDiscount) => {
    if (newDiscount < 0 || newDiscount > 100) return;
    setRows((prevRows) => {
      const updatedRows = [...prevRows];
      updatedRows[index] = {
        ...updatedRows[index],
        discount: parseFloat(newDiscount) || 0,
      };
      return updatedRows;
    });
  };

  const handleDoctorChange = (index, newDoctor) => {
    setRows((prevRows) => {
      const updatedRows = [...prevRows];
      updatedRows[index] = {
        ...updatedRows[index],
        doctor: newDoctor,
      };
      return updatedRows;
    });
  };

  const handleDateChange = (index, newDate) => {
    setRows((prevRows) => {
      const updatedRows = [...prevRows];
      updatedRows[index] = {
        ...updatedRows[index],
        appointmentDate: newDate,
      };
      return updatedRows;
    });
  };

  const handleTimeChange = (index, newTime) => {
    setRows((prevRows) => {
      const updatedRows = [...prevRows];
      updatedRows[index] = {
        ...updatedRows[index],
        appointmentTime: newTime,
      };
      return updatedRows;
    });
  };

  const handleDurationChange = (index, newDuration) => {
    setRows((prevRows) => {
      const updatedRows = [...prevRows];
      updatedRows[index] = {
        ...updatedRows[index],
        duration: parseInt(newDuration) || 0,
      };
      return updatedRows;
    });
  };

  const addRow = () => {
    let defaultServiceName = "";
    let defaultPrice = 0;
    let defaultRequiresTime = false;
    if (services.length > 0) {
      defaultServiceName = services[0].name;
      defaultPrice = services[0].default_price || 0;
      defaultRequiresTime = services[0].requires_time === true;
    }

    setRows((prevRows) => [
      ...prevRows,
      {
        service: defaultServiceName,
        price: defaultPrice,
        discount: 0,
        doctor: doctors.length > 0 ? doctors[0].name : "",
        appointmentDate: defaultRequiresTime
          ? new Date().toISOString().split("T")[0]
          : "",
        appointmentTime: defaultRequiresTime ? "10:00" : "",
        duration: defaultRequiresTime ? 30 : 0,
      },
    ]);
  };

  const removeRow = (index) => {
    if (rows.length > 1) {
      setRows((prevRows) => prevRows.filter((_, i) => i !== index));
    }
  };

  const calculateItemTotal = (price, discount) => {
    const safePrice = price || 0;
    const safeDiscount = discount || 0;
    return safePrice - (safePrice * safeDiscount) / 100;
  };

  const calculateTotal = () => {
    return rows.reduce((total, row) => {
      return total + calculateItemTotal(row.price, row.discount);
    }, 0);
  };

  const downloadPdf = () => {
    if (!pdfUrl) return;
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = `bill-receipt-${new Date()
      .toISOString()
      .slice(0, 10)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printPdf = () => {
    if (!pdfUrl) return;

    const byteCharacters = atob(pdfUrl.split(",")[1]);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    const blob = new Blob(byteArrays, { type: "application/pdf" });
    const blobUrl = URL.createObjectURL(blob);

    const printWindow = window.open(blobUrl, "_blank");
    if (printWindow) {
      setTimeout(() => {
        try {
          printWindow.print();
        } catch (e) {
          console.log("Print dialog could not be automatically opened");
        }
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      }, 1000);
    } else {
      alert(
        "Pop-up blocked by browser. Please allow pop-ups or use the download option instead."
      );
      URL.revokeObjectURL(blobUrl);
    }
  };

  // Submit the bill to /api/bills. 
  // If the user chose a service that has requires_time = false, we won't store date/time => no queue entry.
  const handleSubmit = async () => {
    let isValid = true;
    for (const row of rows) {
      const selectedService = services.find((s) => s.name === row.service);
      if (!selectedService) {
        isValid = false;
        break;
      }
      const requiresTime = selectedService.requires_time === true;

      // Basic validation
      if (!row.service || !row.doctor || row.price <= 0) {
        isValid = false;
        break;
      }
      if (requiresTime && (!row.appointmentDate || !row.appointmentTime)) {
        isValid = false;
        break;
      }
    }

    if (!isValid) {
      setError("Please fill in all required fields (including date/time if the service requires it).");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    setPdfUrl(null);

    try {
      const billData = {
        patient_id: pid,
        rows: rows.map((row) => ({
          service: row.service,
          doctor: row.doctor,
          appointmentDate: row.appointmentDate, // might be blank if requires_time=false
          appointmentTime: row.appointmentTime, // might be blank if requires_time=false
          duration: row.duration || 0,
          price: row.price,
          discount: row.discount,
        })),
        paymentDetails: {
          mode: paymentMode,
          status: paymentStatus,
          total: calculateTotal(),
        },
      };

      const response = await axios.post(`${API_BASE_URL}/api/bills`, billData);

      if (response.data.pdf_base64) {
        const pdfData = `data:application/pdf;base64,${response.data.pdf_base64}`;
        setPdfUrl(pdfData);
        setTimeout(() => {
          printPdf();
        }, 500);
      }

      setSuccessMessage("Bill created successfully!");
    } catch (err) {
      console.error("Error creating bill:", err);
      setError(
        err.response?.data?.detail || "Failed to create bill. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && visible && !submitting) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, submitting]);

  if (!visible || !pid) return null;

  if (patientLoading) {
    return (
      <div className="modal-overlay animate-fade-in" onClick={handleClose}>
        <div
          className="bg-white w-full sm:max-w-[80%] max-w-[95%] max-h-[85%] overflow-y-auto rounded-lg p-6 relative z-[9999] shadow-lg animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-center justify-center p-8">
            <Loader2 size={36} className="text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">
              Loading patient information...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (patientError && !patientInfo.name) {
    return (
      <div className="modal-overlay animate-fade-in" onClick={handleClose}>
        <div
          className="bg-white w-full sm:max-w-[80%] max-w-[95%] max-h-[85%] overflow-y-auto rounded-lg p-6 relative z-[9999] shadow-lg animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Error</h2>
            <button
              className="p-2 bg-gray-300 text-gray-800 hover:bg-gray-400 outline-none border-none rounded-full transition-colors duration-200"
              onClick={handleClose}
              aria-label="Close"
            >
              <X size={20} className="text-muted-foreground" />
            </button>
          </div>
          <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg mb-6 animate-fade-in">
            <p className="text-destructive">{patientError}</p>
            <button
              className="mt-2 px-4 py-2 bg-primary text-white rounded-md"
              onClick={handleClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (
    !patientInfo.name ||
    !patientInfo.gender ||
    !patientInfo.phone ||
    !patientInfo.age
  )
    return null;

  const { name, age, gender, phone } = patientInfo;

  return (
    <div
      className={`modal-overlay ${
        isClosing ? "animate-fade-out" : "animate-fade-in"
      }`}
      onClick={handleClose}
    >
      <div
        className={`bg-white w-full sm:max-w-[80%] max-w-[95%] max-h-[85%] overflow-y-auto rounded-lg p-6 relative z-[9999] shadow-lg ${
          isClosing ? "animate-scale-out" : "animate-scale-in"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-3">
            <div className="bg-primary/10 text-primary p-2 rounded-full">
              <BadgeIndianRupee size={24} />
            </div>
            <h2 className="text-2xl font-semibold">Billing Information</h2>
          </div>
          <button
            className="p-2 bg-gray-300 text-gray-800 hover:bg-gray-400 outline-none border-none rounded-full transition-colors duration-200"
            onClick={handleClose}
            aria-label="Close"
            disabled={submitting}
          >
            <X size={20} className="text-muted-foreground" />
          </button>
        </div>

        <p className="text-muted-foreground mb-8">
          Manage services and customize your billing details below.
        </p>

        {successMessage && (
          <div className="bg-green-100 border border-green-200 text-green-800 p-4 rounded-lg mb-6 animate-fade-in">
            <p className="font-medium">{successMessage}</p>
            {pdfUrl && (
              <div className="flex mt-2 gap-2">
                <button
                  className="px-4 py-2 bg-green-600 text-white rounded-md flex items-center"
                  onClick={printPdf}
                >
                  <Printer size={16} className="mr-2" /> Print
                </button>
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center"
                  onClick={downloadPdf}
                >
                  <FileDown size={16} className="mr-2" /> Download PDF
                </button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg mb-6 animate-fade-in">
            <p className="text-destructive">{error}</p>
            <button
              className="mt-2 px-4 py-2 bg-primary text-white rounded-md"
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Patient details */}
        <div className="bg-primary/5 border border-primary/10 p-4 rounded-lg mb-6 animate-fade-in shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Patient Name</p>
              <p className="font-medium">{name || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Age/Gender</p>
              <p className="font-medium">
                {age || "N/A"} / {gender || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="font-medium">{phone || "N/A"}</p>
            </div>
            <div className="hidden md:block">
              <p className="text-xs text-muted-foreground">Bill Date</p>
              <p className="font-medium">{new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center p-8">
            <Loader2 size={36} className="text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Loading data...</p>
          </div>
        )}

        {!loading && (
          <form action="#">
            {/* Desktop/Larger Screen View */}
            <div className="w-full h-full max-lg:hidden">
              <div className="overflow-hidden rounded-xl border border-border mb-4">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-gray-100 text-gray-900">
                      <tr className="bg-secondary/50 text-secondary-foreground">
                        <th className="px-4 py-3 text-left flex items-center font-medium text-sm w-1/12">
                          Service
                          <Link
                            to="/services"
                            className="ml-1 inline-block w-fit bg-transparent m-0 p-0 border-none focus:outline-none outline-none cursor-pointer"
                          >
                            <PlusCircle size={16} className="text-primary" />
                          </Link>
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-sm w-1/10">
                          Doctor
                          <Link
                            to="/doctors"
                            className="ml-1 inline-block w-fit bg-transparent m-0 p-0 border-none focus:outline-none outline-none cursor-pointer"
                          >
                            <PlusCircle size={16} className="text-primary" />
                          </Link>
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-sm w-1/12">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-sm w-1/12">
                          Time
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-sm w-1/12">
                          Duration
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-sm w-1/12">
                          Price
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-sm w-1/12">
                          Discount
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-sm w-1/12">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-center w-12 font-medium text-sm"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => {
                        const totalForRow = calculateItemTotal(
                          row.price,
                          row.discount
                        );
                        const selectedService = services.find(
                          (s) => s.name === row.service
                        );
                        const requiresTime = selectedService?.requires_time;

                        return (
                          <tr
                            key={index}
                            className="hover:bg-secondary/20 transition-colors duration-200 animate-slide-down"
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            <td className="px-2 py-2 border-t border-border">
                              <select
                                className="w-full p-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring focus:border-input transition-all duration-200"
                                value={row.service}
                                onChange={(e) =>
                                  handleServiceChange(index, e.target.value)
                                }
                                disabled={submitting}
                              >
                                {services.map((service) => (
                                  <option key={service.id} value={service.name}>
                                    {service.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-2 border-t border-border">
                              <select
                                className="w-full p-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring focus:border-input transition-all duration-200"
                                value={row.doctor}
                                onChange={(e) =>
                                  handleDoctorChange(index, e.target.value)
                                }
                                disabled={submitting}
                              >
                                {doctors.map((doctor) => (
                                  <option key={doctor.id} value={doctor.name}>
                                    {doctor.name}{" "}
                                    {doctor.speciality
                                      ? `(${doctor.speciality})`
                                      : ""}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-2 border-t border-border">
                              {requiresTime ? (
                                <input
                                  type="date"
                                  required
                                  className="w-full p-1.5 text-sm bg-background text-black border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring focus:border-input transition-all duration-200"
                                  value={row.appointmentDate}
                                  onChange={(e) =>
                                    handleDateChange(index, e.target.value)
                                  }
                                  disabled={submitting}
                                />
                              ) : (
                                <div className="text-sm text-gray-400">N/A</div>
                              )}
                            </td>
                            <td className="px-2 py-2 border-t border-border">
                              {requiresTime ? (
                                <input
                                  type="time"
                                  required
                                  className="w-full p-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring focus:border-input transition-all duration-200"
                                  value={row.appointmentTime}
                                  onChange={(e) =>
                                    handleTimeChange(index, e.target.value)
                                  }
                                  disabled={submitting}
                                />
                              ) : (
                                <div className="text-sm text-gray-400">N/A</div>
                              )}
                            </td>
                            <td className="px-2 py-2 border-t border-border">
                              {requiresTime ? (
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="15"
                                    step="15"
                                    className="w-full p-1.5 pr-8 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring focus:border-input transition-all duration-200"
                                    value={row.duration}
                                    onChange={(e) =>
                                      handleDurationChange(index, e.target.value)
                                    }
                                    disabled={submitting}
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                    min
                                  </span>
                                </div>
                              ) : (
                                <div className="text-sm text-gray-400">N/A</div>
                              )}
                            </td>
                            <td className="px-2 py-2 border-t border-border">
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                  ₹
                                </span>
                                <input
                                  type="number"
                                  className="w-full p-1.5 pl-5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring focus:border-input transition-all duration-200"
                                  value={row.price}
                                  onChange={(e) =>
                                    handlePriceChange(index, e.target.value)
                                  }
                                  disabled={submitting}
                                />
                              </div>
                            </td>
                            <td className="px-2 py-2 border-t border-border">
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  className="w-full p-1.5 pr-6 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring focus:border-input transition-all duration-200"
                                  value={row.discount}
                                  onChange={(e) =>
                                    handleDiscountChange(index, e.target.value)
                                  }
                                  disabled={submitting}
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                  %
                                </span>
                              </div>
                            </td>
                            <td className="px-2 py-2 border-t border-border font-medium text-sm">
                              ₹{totalForRow.toFixed(2)}
                            </td>
                            <td className="px-2 py-2 border-t border-border text-center">
                              <button
                                type="button"
                                className={`p-1.5 rounded-full bg-gray-100 border-none transition-colors duration-200 ${
                                  rows.length === 1 || submitting
                                    ? "text-muted-foreground cursor-not-allowed"
                                    : "text-destructive hover:bg-destructive/10"
                                }`}
                                onClick={() => removeRow(index)}
                                disabled={rows.length === 1 || submitting}
                                title={
                                  rows.length === 1
                                    ? "Cannot remove the last row"
                                    : "Remove row"
                                }
                              >
                                <Trash2
                                  size={14}
                                  opacity={
                                    rows.length === 1 || submitting ? 0.5 : 1
                                  }
                                />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <button
                type="button"
                className="mb-6 py-2 bg-gray-100 border border-gray-300 text-gray-900 hover:bg-gray-300 border-none outline-none px-3 rounded-lg flex items-center justify-center transition-colors duration-200 text-sm"
                onClick={addRow}
                disabled={submitting}
              >
                <Plus size={14} className="mr-1.5" /> Add Service
              </button>

              {/* Price Summary */}
              <div
                className="bg-secondary/30 p-6 rounded-xl border border-border animate-fade-in"
                style={{ animationDelay: "0.2s" }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-primary/10 p-1.5 rounded-full">
                    <IndianRupee size={16} className="text-primary" />
                  </div>
                  <h3 className="text-base font-medium">Price Summary</h3>
                </div>

                <div className="space-y-2 mb-6">
                  {rows.map((row, index) => {
                    const discountAmount = (row.price * row.discount) / 100;
                    const totalForRow = row.price - discountAmount;

                    const selectedService = services.find(
                      (s) => s.name === row.service
                    );
                    const requiresTime = selectedService?.requires_time;

                    return (
                      <div
                        key={index}
                        className="flex justify-between text-sm py-2 animate-slide-up"
                        style={{ animationDelay: `${index * 50 + 300}ms` }}
                      >
                        <div>
                          <span className="text-muted-foreground">
                            {row.service}
                          </span>
                          {requiresTime && row.appointmentDate && row.appointmentTime && (
                            <div className="text-xs text-muted-foreground mt-1">
                              with {row.doctor} on{" "}
                              {new Date(row.appointmentDate).toLocaleDateString()}{" "}
                              at {row.appointmentTime} ({row.duration} min)
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div>₹{(row.price || 0).toFixed(2)}</div>
                          {row.discount > 0 && (
                            <div className="text-destructive text-xs">
                              -₹{discountAmount.toFixed(2)} ({row.discount}%)
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-border pt-4 flex justify-between items-center">
                  <span className="font-medium">Total</span>
                  <span className="text-xl font-semibold">
                    ₹{calculateTotal().toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Payment details */}
              <div className="bg-secondary/20 p-4 rounded-lg mt-6 border border-border">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Payment Mode:</span>
                    <select
                      className="p-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring focus:border-input transition-all duration-200"
                      defaultValue="cash"
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      disabled={submitting}
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="upi">UPI</option>
                      <option value="insurance">Insurance</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Payment Status:</span>
                    <select
                      className="p-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring focus:border-input transition-all duration-200"
                      defaultValue="paid"
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value)}
                      disabled={submitting}
                    >
                      <option value="paid">Paid</option>
                      <option value="pending">Pending</option>
                      <option value="partial">Partially Paid</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end mt-8 gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="py-2.5 px-5 border-none rounded-lg bg-gray-300 text-gray-800 hover:bg-gray-400 transition-colors duration-200"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="py-2.5 px-5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors duration-200 flex items-center justify-center"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Printer size={18} className="mr-2" />
                      Complete Billing
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Mobile View */}
            <div className="w-full h-full lg:hidden">
              <BillingMobileView
                rows={rows}
                services={services}
                doctors={doctors}
                handleServiceChange={handleServiceChange}
                handlePriceChange={handlePriceChange}
                handleDiscountChange={handleDiscountChange}
                handleDoctorChange={handleDoctorChange}
                handleDateChange={handleDateChange}
                handleTimeChange={handleTimeChange}
                handleDurationChange={handleDurationChange}
                removeRow={removeRow}
                calculateItemTotal={calculateItemTotal}
                calculateTotal={calculateTotal}
                addRow={addRow}
                handleClose={handleClose}
                paymentMode={paymentMode}
                setPaymentMode={setPaymentMode}
                paymentStatus={paymentStatus}
                setPaymentStatus={setPaymentStatus}
                onSubmit={handleSubmit}
                loading={loading}
                submitting={submitting}
              />
            </div>
          </form>
        )}

        <iframe
          ref={printFrameRef}
          style={{ display: "none", width: 0, height: 0 }}
          title="Print PDF"
        />
      </div>
    </div>
  );
};

export default BillingModal;
