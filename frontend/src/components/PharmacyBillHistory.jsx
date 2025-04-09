import { useState, useEffect } from "react";
import axios from "axios";
import {
  Loader2,
  FileDown,
  Printer,
  Search,
  ChevronDown,
  ChevronUp,
  IndianRupee,
  FilterX,
} from "lucide-react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const PharmacyBillHistory = () => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("recent");
  const [patientIdFilter, setPatientIdFilter] = useState("");
  const [expandedBillId, setExpandedBillId] = useState(null);

  // Fetch bills based on filter
  useEffect(() => {
    const fetchBills = async () => {
      setLoading(true);
      setError(null);

      try {
        let response;

        if (filter === "recent") {
          response = await axios.get(
            `${API_BASE_URL}/api/pharmacy/bills/recent`
          );
        } else if (
          filter === "paid" ||
          filter === "pending" ||
          filter === "partial"
        ) {
          response = await axios.get(
            `${API_BASE_URL}/api/pharmacy/bills/status/${filter}`
          );
        } else if (filter === "patient" && patientIdFilter) {
          response = await axios.get(
            `${API_BASE_URL}/api/pharmacy/patient/${patientIdFilter}/bills`
          );
        } else {
          // Default to recent bills
          response = await axios.get(
            `${API_BASE_URL}/api/pharmacy/bills/recent`
          );
        }

        setBills(response.data);
      } catch (err) {
        console.error("Error fetching bills:", err);
        setError("Failed to load pharmacy bills. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchBills();
  }, [filter, patientIdFilter]);

  // Download PDF for a bill
  const handleDownloadPdf = async (billId) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/pharmacy/bills/${billId}/pdf`,
        {
          responseType: "blob",
        }
      );

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

  // Print PDF for a bill
  const handlePrintPdf = async (billId) => {
    try {
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

  // Toggle expanded bill
  const toggleBillExpansion = (billId) => {
    setExpandedBillId(expandedBillId === billId ? null : billId);
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Reset filters
  const handleResetFilters = () => {
    setFilter("recent");
    setPatientIdFilter("");
  };

  // Search by patient ID
  const handlePatientSearch = (e) => {
    e.preventDefault();
    if (patientIdFilter.trim()) {
      setFilter("patient");
    }
  };

  return (
    <div className="w-screen mx-auto px-4 py-6">
      {/* Content Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Billing History</h2>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <button
              className={`px-3 py-1.5 rounded-md ${
                filter === "recent"
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              onClick={() => setFilter("recent")}
            >
              Recent Bills
            </button>
            <button
              className={`px-3 py-1.5 rounded-md ${
                filter === "paid"
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              onClick={() => setFilter("paid")}
            >
              Paid Bills
            </button>
            <button
              className={`px-3 py-1.5 rounded-md ${
                filter === "pending"
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              onClick={() => setFilter("pending")}
            >
              Pending Bills
            </button>
            <button
              className={`px-3 py-1.5 rounded-md ${
                filter === "partial"
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              onClick={() => setFilter("partial")}
            >
              Partially Paid
            </button>
          </div>

          <div className="w-full sm:w-auto flex gap-2">
            <form onSubmit={handlePatientSearch} className="flex">
              <input
                type="text"
                placeholder="Search by Patient ID"
                value={patientIdFilter}
                onChange={(e) => setPatientIdFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-l-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-primary text-white rounded-r-md"
              >
                <Search size={16} />
              </button>
            </form>

            {(filter !== "recent" || patientIdFilter) && (
              <button
                onClick={handleResetFilters}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center gap-1"
              >
                <FilterX size={16} />
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <Loader2 size={24} className="animate-spin text-primary mr-2" />
          <span>Loading bills...</span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg border border-red-200">
          <p>{error}</p>
        </div>
      )}

      {/* No bills found */}
      {!loading && !error && bills.length === 0 && (
        <div className="bg-gray-100 p-8 text-center rounded-lg border border-gray-200">
          <p className="text-gray-500 mb-2">No pharmacy bills found</p>
          <p className="text-sm text-gray-400">
            {filter === "patient"
              ? `No bills found for patient ID: ${patientIdFilter}`
              : filter === "recent"
              ? "No recent bills found"
              : `No ${filter} bills found`}
          </p>
        </div>
      )}

      {/* Bills list */}
      {!loading && !error && bills.length > 0 && (
        <div className="space-y-4">
          {bills.map((bill) => (
            <div
              key={bill.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
            >
              {/* Bill header - always visible */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                onClick={() => toggleBillExpansion(bill.id)}
              >
                <div className="flex items-center space-x-4">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <IndianRupee size={16} className="text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">Bill #{bill.id}</div>
                    <div className="text-sm text-gray-500">
                      <span className="mr-3">{formatDate(bill.bill_date)}</span>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                          bill.payment_status === "paid"
                            ? "bg-green-100 text-green-700"
                            : bill.payment_status === "pending"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {bill.payment_status.charAt(0).toUpperCase() +
                          bill.payment_status.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <div className="font-semibold">
                      ₹{bill.total_amount.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {bill.payment_mode.charAt(0).toUpperCase() +
                        bill.payment_mode.slice(1)}
                    </div>
                  </div>
                  <div>
                    {expandedBillId === bill.id ? (
                      <ChevronUp />
                    ) : (
                      <ChevronDown />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded bill details */}
              {expandedBillId === bill.id && (
                <div className="border-t border-gray-200 p-4 animate-[slideDown_0.2s_ease-out]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-2">
                        Patient Information
                      </h3>
                      <div className="bg-gray-50 p-3 rounded-md">
                        <p className="font-medium">{bill.patient_name}</p>
                        <p className="text-sm">
                          {bill.patient_age && bill.patient_gender
                            ? `${bill.patient_age} yrs, ${bill.patient_gender}`
                            : ""}
                          {bill.patient_phone && (
                            <span className="block">
                              Phone: {bill.patient_phone}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-2">
                        Bill Actions
                      </h3>
                      <div className="flex gap-2">
                        <button
                          className="px-3 py-2 bg-blue-600 text-white rounded-md shadow-sm flex items-center gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadPdf(bill.id);
                          }}
                        >
                          <FileDown size={16} />
                          Download PDF
                        </button>
                        <button
                          className="px-3 py-2 bg-green-600 text-white rounded-md shadow-sm flex items-center gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrintPdf(bill.id);
                          }}
                        >
                          <Printer size={16} />
                          Print
                        </button>
                      </div>
                    </div>
                  </div>

                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    Bill Items
                  </h3>
                  <div className="bg-gray-50 rounded-md overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                            Medicine
                          </th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">
                            Quantity
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                            Price (₹)
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                            Discount
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                            Total (₹)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {bill.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-2 text-sm">
                              {item.medicine_name}
                            </td>
                            <td className="px-4 py-2 text-sm text-center">
                              {item.quantity}
                            </td>
                            <td className="px-4 py-2 text-sm text-right">
                              {item.price_per_unit.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-sm text-right">
                              {item.discount_percentage > 0
                                ? `${item.discount_percentage}%`
                                : "-"}
                            </td>
                            <td className="px-4 py-2 text-sm font-medium text-right">
                              {item.item_total.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-100">
                          <td
                            colSpan="4"
                            className="px-4 py-2 text-right font-medium"
                          >
                            Total Amount:
                          </td>
                          <td className="px-4 py-2 text-right font-bold">
                            ₹{bill.total_amount.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PharmacyBillHistory;