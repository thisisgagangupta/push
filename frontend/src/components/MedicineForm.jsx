import { useState, useEffect } from "react";
import { Save, X } from "lucide-react";

const MedicineForm = ({ medicine, onSubmit, onCancel }) => {
  // Initialize form with empty values or medicine data if editing
  const [formData, setFormData] = useState({
    id: null,
    name: "",
    quantity: 0,
    defaultPrice: 0,
    manufacturer: "",
  });

  // When medicine prop changes, update form data
  useEffect(() => {
    if (medicine) {
      setFormData({
        id: medicine.id,
        name: medicine.name,
        quantity: medicine.quantity,
        defaultPrice: medicine.defaultPrice,
        manufacturer: medicine.manufacturer,
      });
    }
  }, [medicine]);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Convert number fields
    if (name === "quantity") {
      setFormData({ ...formData, [name]: parseInt(value) || 0 });
    } else if (name === "defaultPrice") {
      setFormData({ ...formData, [name]: parseFloat(value) || 0 });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Medicine Name*
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
            placeholder="Enter medicine name"
          />
        </div>

        <div>
          <label
            htmlFor="manufacturer"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Manufacturer*
          </label>
          <input
            type="text"
            id="manufacturer"
            name="manufacturer"
            required
            value={formData.manufacturer}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
            placeholder="Enter manufacturer name"
          />
        </div>

        <div>
          <label
            htmlFor="quantity"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Quantity*
          </label>
          <input
            type="number"
            id="quantity"
            name="quantity"
            required
            min="0"
            value={formData.quantity}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
            placeholder="Enter quantity"
          />
        </div>

        <div>
          <label
            htmlFor="defaultPrice"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Default Price (₹)*
          </label>
          <input
            type="number"
            id="defaultPrice"
            name="defaultPrice"
            required
            min="0"
            step="0.01"
            value={formData.defaultPrice}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
            placeholder="Enter default price"
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary flex items-center"
        >
          <X size={16} className="mr-1" /> Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary flex items-center"
        >
          <Save size={16} className="mr-1" /> {medicine ? "Update" : "Save"}
        </button>
      </div>
    </form>
  );
};

export default MedicineForm;