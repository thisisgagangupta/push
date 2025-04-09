import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import PharmacyInventory from "./PharmacyInventory";
import PharmacyBilling from "./PharmacyBilling";
import { Loader2 } from "lucide-react";
import axios from "axios";
import PharmacyBillHistory from "./PharmacyBillHistory";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const PharmacyPage = () => {
  // Use location to determine which tab to display based on URL
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active tab based on URL path
  const getActiveTabFromPath = () => {
    if (location.pathname.includes("/pharmacy/billing")) {
      return "billing";
    } else if (location.pathname.includes("/pharmacy/bills")) {
      return "history";
    }
    return "inventory";
  };

  const [activeTab, setActiveTab] = useState(getActiveTabFromPath);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Update the active tab when the URL changes
  useEffect(() => {
    setActiveTab(getActiveTabFromPath());
  }, [location.pathname]);

  // Fetch medicines from API on component mount
  useEffect(() => {
    const fetchMedicines = async () => {
      setLoading(true);
      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/pharmacy/medicines`
        );

        // Transform API response to match component expectations
        const formattedMedicines = response.data.map((medicine) => ({
          id: medicine.id,
          name: medicine.name,
          quantity: medicine.quantity,
          defaultPrice: medicine.default_price,
          manufacturer: medicine.manufacturer,
        }));

        setMedicines(formattedMedicines);
        setError(null);
      } catch (err) {
        console.error("Error fetching medicines:", err);
        setError("Failed to load medicines. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchMedicines();
  }, []);

  // Handler for changing tabs and updating URL
  const handleTabChange = (tab) => {
    if (tab === "inventory") {
      navigate("/pharmacy");
    } else if (tab === "billing") {
      navigate("/pharmacy/billing");
    } else if (tab === "history") {
      navigate("/pharmacy/bills");
    }
  };

  // Handler for adding a new medicine
  const handleAddMedicine = async (newMedicine) => {
    try {
      // Format the data according to API expectations
      const medicineData = {
        name: newMedicine.name,
        manufacturer: newMedicine.manufacturer,
        quantity: newMedicine.quantity,
        default_price: newMedicine.defaultPrice,
      };

      // Call the API to add the medicine
      const response = await axios.post(
        `${API_BASE_URL}/api/pharmacy/medicines`,
        medicineData
      );

      // Format the response and update the state
      const addedMedicine = {
        id: response.data.id,
        name: response.data.name,
        quantity: response.data.quantity,
        defaultPrice: response.data.default_price,
        manufacturer: response.data.manufacturer,
      };

      setMedicines([...medicines, addedMedicine]);
    } catch (err) {
      console.error("Error adding medicine:", err);
      setError("Failed to add medicine. Please try again.");
    }
  };

  // Handler for updating a medicine
  const handleUpdateMedicine = async (updatedMedicine) => {
    try {
      // Format the data according to API expectations
      const medicineData = {
        name: updatedMedicine.name,
        manufacturer: updatedMedicine.manufacturer,
        quantity: updatedMedicine.quantity,
        default_price: updatedMedicine.defaultPrice,
      };

      // Call the API to update the medicine
      const response = await axios.put(
        `${API_BASE_URL}/api/pharmacy/medicines/${updatedMedicine.id}`,
        medicineData
      );

      // Update the local state with the updated medicine
      setMedicines(
        medicines.map((medicine) =>
          medicine.id === updatedMedicine.id
            ? {
                id: response.data.id,
                name: response.data.name,
                quantity: response.data.quantity,
                defaultPrice: response.data.default_price,
                manufacturer: response.data.manufacturer,
              }
            : medicine
        )
      );
    } catch (err) {
      console.error("Error updating medicine:", err);
      setError("Failed to update medicine. Please try again.");
    }
  };

  // Handler for deleting a medicine
  const handleDeleteMedicine = async (medicineId) => {
    try {
      // Call the API to delete the medicine
      await axios.delete(
        `${API_BASE_URL}/api/pharmacy/medicines/${medicineId}`
      );

      // Update the local state by removing the deleted medicine
      setMedicines(medicines.filter((medicine) => medicine.id !== medicineId));
    } catch (err) {
      console.error("Error deleting medicine:", err);
      setError("Failed to delete medicine. Please try again.");
    }
  };

  return (
    <div className="w-screen mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-8">Pharmacy Management</h1>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-300 mb-6">
        <button
          className={`px-6 border-none focus:outline-none py-3 font-medium relative transition-all duration-200 ${
            activeTab === "inventory"
              ? "text-primary bg-primary/5 rounded-t-lg border-t border-x border-gray-300"
              : "text-gray-500 hover:text-gray-700 bg-transparent hover:bg-gray-300"
          }`}
          onClick={() => handleTabChange("inventory")}
        >
          Inventory
          {activeTab === "inventory" && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></span>
          )}
        </button>
        <button
          className={`px-6 py-3 border-none focus:outline-none font-medium relative transition-all duration-200 ${
            activeTab === "billing"
              ? "text-primary bg-primary/5 rounded-t-lg border-t border-x border-gray-300"
              : "text-gray-500 hover:text-gray-700 bg-transparent hover:bg-gray-300"
          }`}
          onClick={() => handleTabChange("billing")}
        >
          Billing
          {activeTab === "billing" && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></span>
          )}
        </button>
        <button
          className={`px-6 py-3 border-none focus:outline-none font-medium relative transition-all duration-200 ${
            activeTab === "history"
              ? "text-primary bg-primary/5 rounded-t-lg border-t border-x border-gray-300"
              : "text-gray-500 hover:text-gray-700 bg-transparent hover:bg-gray-300"
          }`}
          onClick={() => handleTabChange("history")}
        >
          Bill History
          {activeTab === "history" && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></span>
          )}
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-100 p-4 rounded-md mb-4 text-red-700">
          <p>{error}</p>
        </div>
      )}

      {/* Content based on active tab */}
      {!loading && !error && (
        <>
          {activeTab === "inventory" && (
            <PharmacyInventory
              medicines={medicines}
              onAddMedicine={handleAddMedicine}
              onUpdateMedicine={handleUpdateMedicine}
              onDeleteMedicine={handleDeleteMedicine}
            />
          )}

          {activeTab === "billing" && (
            <PharmacyBilling
              medicines={medicines}
              onUpdateMedicine={handleUpdateMedicine}
            />
          )}

          {activeTab === "history" && <PharmacyBillHistory />}
        </>
      )}
    </div>
  );
};

export default PharmacyPage;