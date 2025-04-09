import { useState } from "react";
import { Trash2, Edit, Plus, Search, X, AlertCircle } from "lucide-react";
import MedicineForm from "./MedicineForm";

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity"
          aria-hidden="true"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">{title}</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

const PharmacyInventory = ({
  medicines,
  onAddMedicine,
  onUpdateMedicine,
  onDeleteMedicine,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);
  const [error, setError] = useState(null);
  const lowStockThreshold = 10;
  const [filterMode, setFilterMode] = useState("all"); // "all", "lowStock", "outOfStock"

  // Filter medicines based on search query and filter mode
  const filteredMedicines = medicines.filter((medicine) => {
    // First apply search filter
    const matchesSearch =
      (medicine.name
        ? medicine.name.toLowerCase().includes(searchQuery.toLowerCase())
        : false) ||
      (medicine.manufacturer
        ? medicine.manufacturer
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
        : false);

    // Then apply stock filter
    if (filterMode === "lowStock") {
      return (
        matchesSearch &&
        medicine.quantity > 0 &&
        medicine.quantity <= lowStockThreshold
      );
    } else if (filterMode === "outOfStock") {
      return matchesSearch && medicine.quantity === 0;
    } else {
      return matchesSearch;
    }
  });

  // Handle opening the edit modal
  const handleEditClick = (medicine) => {
    setEditingMedicine(medicine);
  };

  // Handle medicine update submission
  const handleUpdateSubmit = (updatedMedicine) => {
    onUpdateMedicine(updatedMedicine);
    setEditingMedicine(null);
  };

  // Handle add medicine submission
  const handleAddSubmit = (newMedicine) => {
    onAddMedicine(newMedicine);
    setShowAddModal(false);
  };

  // Handle delete with confirmation
  const handleDeleteClick = (id, name) => {
    if (window.confirm(`Are you sure you want to delete ${name}?`)) {
      onDeleteMedicine(id);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Medicine Inventory</h2>
        <button
          className="px-4 py-2 bg-primary text-white rounded-md flex items-center hover:bg-primary/90 transition-colors"
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={16} className="mr-1" /> Add Medicine
        </button>
      </div>

      {/* Filter Options */}
      <div className="flex flex-col md:flex-row justify-between space-y-4 md:space-y-0 mb-6">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm"
            placeholder="Search medicines by name or manufacturer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex space-x-2">
          <button
            className={`px-3 py-1 rounded border ${
              filterMode === "all"
                ? "bg-primary text-white border-primary"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
            onClick={() => setFilterMode("all")}
          >
            All Medicines
          </button>
          <button
            className={`px-3 py-1 rounded border ${
              filterMode === "lowStock"
                ? "bg-yellow-500 text-white border-yellow-500"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
            onClick={() => setFilterMode("lowStock")}
          >
            Low Stock
          </button>
          <button
            className={`px-3 py-1 rounded border ${
              filterMode === "outOfStock"
                ? "bg-red-500 text-white border-red-500"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
            onClick={() => setFilterMode("outOfStock")}
          >
            Out of Stock
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4 flex items-start">
          <AlertCircle size={20} className="mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-sm text-red-600 underline mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Add Medicine Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Medicine"
      >
        <MedicineForm
          onSubmit={handleAddSubmit}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>

      {/* Edit Medicine Modal */}
      <Modal
        isOpen={!!editingMedicine}
        onClose={() => setEditingMedicine(null)}
        title="Edit Medicine"
      >
        {editingMedicine && (
          <MedicineForm
            medicine={editingMedicine}
            onSubmit={handleUpdateSubmit}
            onCancel={() => setEditingMedicine(null)}
          />
        )}
      </Modal>

      {/* Medicines Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Manufacturer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Default Price (₹)
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredMedicines.length > 0 ? (
              filteredMedicines.map((medicine) => (
                <tr key={medicine.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">
                      {medicine.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {medicine.manufacturer}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center space-x-2">
                      <span
                        className={
                          medicine.quantity === 0
                            ? "text-red-600 font-medium"
                            : medicine.quantity <= lowStockThreshold
                            ? "text-yellow-600 font-medium"
                            : "text-gray-500"
                        }
                      >
                        {medicine.quantity}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ₹{medicine.defaultPrice.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEditClick(medicine)}
                      className="inline-flex items-center justify-center p-2 text-white bg-primary rounded-full hover:bg-primary/90 mr-2 transition-colors"
                      title="Edit"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() =>
                        handleDeleteClick(medicine.id, medicine.name)
                      }
                      className="inline-flex items-center justify-center p-2 text-white bg-red-500 rounded-full hover:bg-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="5"
                  className="px-6 py-4 text-center text-sm text-gray-500"
                >
                  {searchQuery
                    ? "No medicines match your search."
                    : "No medicines available."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Stats summary */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="text-blue-800 text-sm font-medium">
            Total Medicines
          </div>
          <div className="text-2xl font-bold">{medicines.length}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="text-green-800 text-sm font-medium">In Stock</div>
          <div className="text-2xl font-bold">
            {medicines.filter((m) => m.quantity > 0).length}
          </div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <div className="text-red-800 text-sm font-medium">
            Low Stock (≤ {lowStockThreshold})
          </div>
          <div className="text-2xl font-bold">
            {
              medicines.filter(
                (m) => m.quantity > 0 && m.quantity <= lowStockThreshold
              ).length
            }
          </div>
        </div>
      </div>
    </div>
  );
};

export default PharmacyInventory;