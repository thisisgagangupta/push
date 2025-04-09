import { useState, useRef } from "react";
import axios from "axios";
import {
  Plus,
  IndianRupee,
  Printer,
  Loader2,
  Save,
  FileDown,
} from "lucide-react";
import PatientInfoForm from "./PatientInfoForm";
import BillingItemsTable from "./BillingItemsTable";
import MobileBillingView from "./MobileBillingView";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const PharmacyBilling = ({ medicines, onUpdateMedicine }) => {
  // Patient information state
  const [patientInfo, setPatientInfo] = useState({
    id: "",
    name: "",
    age: "",
    gender: "",
    phone: "",
  });

  const [patientLoading, setPatientLoading] = useState(false);
  const [patientError, setPatientError] = useState(null);

  // Billing items state
  const [items, setItems] = useState([
    {
      medicineId: medicines.length > 0 ? medicines[0].id : "",
      name: medicines.length > 0 ? medicines[0].name : "",
      quantity: 1,
      price: medicines.length > 0 ? medicines[0].defaultPrice : 0,
      discount: 0,
    },
  ]);

  // Other billing states
  const [paymentMode, setPaymentMode] = useState("cash");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [billId, setBillId] = useState(null);
  const printFrameRef = useRef(null);

  // Reset the billing form
  const resetForm = () => {
    setPatientInfo({
      id: "",
      name: "",
      age: "",
      gender: "",
      phone: "",
    });

    setItems([
      {
        medicineId: medicines.length > 0 ? medicines[0].id : "",
        name: medicines.length > 0 ? medicines[0].name : "",
        quantity: 1,
        price: medicines.length > 0 ? medicines[0].defaultPrice : 0,
        discount: 0,
      },
    ]);

    setPaymentMode("cash");
    setPaymentStatus("paid");
    setPdfUrl(null);
    setBillId(null);
    setSuccessMessage(null);
    setError(null);
  };

  // Fetch patient information by ID
  // Fetch patient information by ID
  const fetchPatientInfo = async (patientId) => {
    if (!patientId) {
      setPatientError("Please enter a valid Patient ID");
      return;
    }

    setPatientLoading(true);
    setPatientError(null);

    try {
      // Make API call to get patient information
      const response = await axios.get(
        `${API_BASE_URL}/api/patient/${patientId}`
      );

      if (response.data) {
        setPatientInfo({
          id: patientId,
          name: response.data.patient_name,
          age: response.data.age,
          gender: response.data.gender,
          phone: response.data.contact_number,
        });
      } else {
        setPatientError(
          "Patient not found. Please enter patient details manually."
        );
      }
    } catch (err) {
      console.error("Error fetching patient info:", err);

      if (err.response) {
        // Handle specific status codes
        if (err.response.status === 404) {
          setPatientError(
            "Patient not found. Please enter patient details manually."
          );
        } else {
          setPatientError(
            `Failed to load patient information: ${
              err.response.data.detail || "Unknown error"
            }`
          );
        }
      } else {
        setPatientError(
          "Failed to load patient information. Please try again."
        );
      }
    } finally {
      setPatientLoading(false);
    }
  };

  // Handle medicine selection
  const handleMedicineChange = (index, medicineId) => {
    const selectedMedicine = medicines.find(
      (m) => m.id === parseInt(medicineId)
    );
    if (!selectedMedicine) return;

    setItems((prevItems) => {
      const updatedItems = [...prevItems];
      updatedItems[index] = {
        ...updatedItems[index],
        medicineId: selectedMedicine.id,
        name: selectedMedicine.name,
        price: selectedMedicine.defaultPrice,
        quantity: 1,
      };
      return updatedItems;
    });
  };

  // Handle quantity change
  const handleQuantityChange = (index, newQuantity) => {
    if (newQuantity < 1) return;

    const medicineId = items[index].medicineId;
    const selectedMedicine = medicines.find(
      (m) => m.id === parseInt(medicineId)
    );

    // Don't allow quantity greater than available stock
    if (selectedMedicine && newQuantity > selectedMedicine.quantity) {
      setError(
        `Only ${selectedMedicine.quantity} units of ${selectedMedicine.name} available in stock`
      );
      return;
    }

    setItems((prevItems) => {
      const updatedItems = [...prevItems];
      updatedItems[index] = {
        ...updatedItems[index],
        quantity: parseInt(newQuantity),
      };
      return updatedItems;
    });

    // Clear any previous errors
    setError(null);
  };

  // Handle price change
  const handlePriceChange = (index, newPrice) => {
    setItems((prevItems) => {
      const updatedItems = [...prevItems];
      updatedItems[index] = {
        ...updatedItems[index],
        price: parseFloat(newPrice) || 0,
      };
      return updatedItems;
    });
  };

  // Handle discount change
  const handleDiscountChange = (index, newDiscount) => {
    if (newDiscount < 0 || newDiscount > 100) return;

    setItems((prevItems) => {
      const updatedItems = [...prevItems];
      updatedItems[index] = {
        ...updatedItems[index],
        discount: parseFloat(newDiscount) || 0,
      };
      return updatedItems;
    });
  };

  // Add a new item row
  const addItem = () => {
    if (medicines.length === 0) return;

    setItems((prevItems) => [
      ...prevItems,
      {
        medicineId: medicines[0].id,
        name: medicines[0].name,
        quantity: 1,
        price: medicines[0].defaultPrice,
        discount: 0,
      },
    ]);
  };

  // Remove an item
  const removeItem = (index) => {
    if (items.length > 1) {
      setItems((prevItems) => prevItems.filter((_, i) => i !== index));
    }
  };

  // Calculate total for an item
  const calculateItemTotal = (price, quantity, discount) => {
    const safePrice = price || 0;
    const safeQuantity = quantity || 0;
    const safeDiscount = discount || 0;
    return safePrice * safeQuantity * (1 - safeDiscount / 100);
  };

  // Calculate grand total
  const calculateTotal = () => {
    return items.reduce((total, item) => {
      return (
        total + calculateItemTotal(item.price, item.quantity, item.discount)
      );
    }, 0);
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Validate patient info
    if (!patientInfo.name || !patientInfo.phone) {
      setError("Patient name and phone number are required");
      return;
    }

    // Validate items
    if (
      items.some(
        (item) => !item.medicineId || item.quantity < 1 || item.price <= 0
      )
    ) {
      setError("Please ensure all medicines have valid quantities and prices");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    setPdfUrl(null);

    try {
      // Prepare the data for the API
      const billData = {
        patient: {
          id: patientInfo.id ? parseInt(patientInfo.id) : null,
          name: patientInfo.name,
          age: patientInfo.age ? parseInt(patientInfo.age) : null,
          gender: patientInfo.gender,
          phone: patientInfo.phone,
        },
        items: items.map((item) => ({
          medicineId: parseInt(item.medicineId),
          name: item.name,
          quantity: parseInt(item.quantity),
          price: parseFloat(item.price),
          discount: parseFloat(item.discount),
        })),
        payment: {
          mode: paymentMode,
          status: paymentStatus,
          total: calculateTotal(),
        },
      };

      // Call the API to create a new pharmacy bill
      const response = await axios.post(
        `${API_BASE_URL}/api/pharmacy/bills`,
        billData
      );

      // Store the bill ID for future reference
      setBillId(response.data.id);

      // Set the PDF URL if it's returned in the response
      if (response.data.pdf_base64) {
        setPdfUrl(`data:application/pdf;base64,${response.data.pdf_base64}`);
      }

      // Update medicine quantities in the parent component
      const updatedMedicines = medicines.map((medicine) => {
        const billingItem = items.find(
          (item) => item.medicineId === medicine.id
        );
        if (billingItem) {
          return {
            ...medicine,
            quantity: medicine.quantity - billingItem.quantity,
          };
        }
        return medicine;
      });

      // Update each medicine in the parent component
      updatedMedicines.forEach((medicine) => {
        const originalMedicine = medicines.find((m) => m.id === medicine.id);
        if (
          originalMedicine &&
          originalMedicine.quantity !== medicine.quantity
        ) {
          onUpdateMedicine(medicine);
        }
      });

      // Show success message
      setSuccessMessage("Billing completed successfully!");

      // Auto-print option
      setTimeout(() => {
        if (window.confirm("Would you like to print the bill receipt?")) {
          printPdf();
        }
      }, 500);
    } catch (err) {
      console.error("Error processing billing:", err);
      if (err.response && err.response.data && err.response.data.detail) {
        setError(`Failed to process billing: ${err.response.data.detail}`);
      } else {
        setError("Failed to process billing. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Download PDF function
  const downloadPdf = async () => {
    if (!billId) return;

    try {
      // Generate a download link for the PDF
      const response = await axios.get(
        `${API_BASE_URL}/api/pharmacy/bills/${billId}/pdf`,
        {
          responseType: "blob",
        }
      );

      // Create a download link and click it
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `pharmacy-bill-${billId}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading PDF:", err);
      setError("Failed to download PDF. Please try again.");
    }
  };

  // Print PDF function
  const printPdf = async () => {
    if (!billId) return;

    try {
      // Open the PDF in a new window for printing
      const printWindow = window.open(
        `${API_BASE_URL}/api/pharmacy/bills/${billId}/pdf`,
        "_blank"
      );

      if (printWindow) {
        setTimeout(() => {
          printWindow.print();
        }, 1000);
      } else {
        alert("Pop-up blocked. Please allow pop-ups to print the receipt.");
      }
    } catch (error) {
      console.error("Error printing PDF:", error);
      alert("Unable to print. You can download the PDF instead.");
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Pharmacy Billing</h2>
        {successMessage ? (
          <div className="flex space-x-2">
            <button
              className="px-4 py-2 bg-green-600 text-white rounded-md flex items-center"
              onClick={printPdf}
            >
              <Printer size={16} className="mr-1" /> Print
            </button>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center"
              onClick={downloadPdf}
            >
              <FileDown size={16} className="mr-1" /> Download
            </button>
            <button
              className="px-4 py-2 bg-gray-600 text-white rounded-md flex items-center"
              onClick={resetForm}
            >
              <Plus size={16} className="mr-1" /> New Bill
            </button>
          </div>
        ) : null}
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-100 border border-green-200 text-green-800 p-4 rounded-lg mb-6 animate-fade-in">
          <p className="font-medium">{successMessage}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-200 text-red-800 p-4 rounded-lg mb-6 animate-fade-in">
          <p className="font-medium">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm text-red-600 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Patient Information Section */}
      <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 mb-6">
        <PatientInfoForm
          patientInfo={patientInfo}
          setPatientInfo={setPatientInfo}
          fetchPatientInfo={fetchPatientInfo}
          patientLoading={patientLoading}
          patientError={patientError}
          setPatientError={setPatientError}
          disabled={submitting || !!successMessage}
        />
      </div>

      {/* Desktop Billing Table (hidden on mobile) */}
      <div className="block max-w-md:hidden">
        <BillingItemsTable
          items={items}
          medicines={medicines}
          onMedicineChange={handleMedicineChange}
          onQuantityChange={handleQuantityChange}
          onPriceChange={handlePriceChange}
          onDiscountChange={handleDiscountChange}
          onRemoveItem={removeItem}
          onAddItem={addItem}
          calculateItemTotal={calculateItemTotal}
          disabled={submitting || !!successMessage}
        />
      </div>

      {/* Mobile Billing View (visible only on mobile) */}
      <div className="md:hidden">
        <MobileBillingView
          items={items}
          medicines={medicines}
          onMedicineChange={handleMedicineChange}
          onQuantityChange={handleQuantityChange}
          onPriceChange={handlePriceChange}
          onDiscountChange={handleDiscountChange}
          onRemoveItem={removeItem}
          onAddItem={addItem}
          calculateItemTotal={calculateItemTotal}
          disabled={submitting || !!successMessage}
        />
      </div>

      {/* Price Summary */}
      <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-primary/10 p-1.5 rounded-full">
            <IndianRupee size={16} className="text-primary" />
          </div>
          <h3 className="text-base font-medium">Price Summary</h3>
        </div>

        <div className="space-y-2 mb-6">
          {items.map((item, index) => {
            const total = calculateItemTotal(
              item.price,
              item.quantity,
              item.discount
            );

            return (
              <div
                key={index}
                className="flex justify-between text-sm py-2 border-b border-gray-100 last:border-b-0"
              >
                <div>
                  <span className="font-medium">{item.name}</span>
                  <div className="text-xs text-gray-500 mt-1">
                    {item.quantity} x ₹{item.price.toFixed(2)}
                    {item.discount > 0 ? ` (-${item.discount}% discount)` : ""}
                  </div>
                </div>
                <div className="text-right font-medium">
                  ₹{total.toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-gray-300 pt-4 flex justify-between items-center">
          <span className="font-medium">Total Amount</span>
          <span className="text-xl font-semibold">
            ₹{calculateTotal().toFixed(2)}
          </span>
        </div>
      </div>

      {/* Payment Options */}
      <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 mt-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="w-full sm:w-1/2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Mode
            </label>
            <select
              className="w-full p-2 border border-gray-300 rounded-md"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              disabled={submitting || !!successMessage}
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI/Mobile Payment</option>
              <option value="insurance">Insurance</option>
              <option value="credit">Store Credit</option>
            </select>
          </div>

          <div className="w-full sm:w-1/2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Status
            </label>
            <select
              className="w-full p-2 border border-gray-300 rounded-md"
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              disabled={submitting || !!successMessage}
            >
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="partial">Partially Paid</option>
            </select>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="mt-8 flex justify-end">
        {!successMessage && (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-3 bg-primary text-white rounded-md shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 flex items-center"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                <Save size={18} className="mr-2" />
                Complete Billing
              </>
            )}
          </button>
        )}
      </div>

      {/* Hidden iframe for printing */}
      <iframe
        ref={printFrameRef}
        style={{ display: "none", width: 0, height: 0 }}
        title="Print PDF"
      />
    </div>
  );
};

export default PharmacyBilling;