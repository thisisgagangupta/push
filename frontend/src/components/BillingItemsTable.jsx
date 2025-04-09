import { Trash2, Plus, AlertCircle } from "lucide-react";

const BillingItemsTable = ({
  items,
  medicines,
  onMedicineChange,
  onQuantityChange,
  onPriceChange,
  onDiscountChange,
  onRemoveItem,
  onAddItem,
  calculateItemTotal,
  disabled = false,
}) => {
  return (
    <div className="w-full bg-white rounded-lg p-4 border border-gray-300 shadow-sm">
      <h3 className="text-lg font-medium mb-3">Selected Medicines</h3>

      <div className="w-full bg-white rounded-lg border border-gray-200 overflow-auto min-h-[200px]">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                Medicine
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                Quantity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                Price (₹)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                Discount (%)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                Total (₹)
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16 border-b border-gray-200">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item, index) => {
              // Get the selected medicine for stock checking
              const selectedMedicine = item.medicineId
                ? medicines.find((m) => m.id === parseInt(item.medicineId))
                : null;

              // Check if stock warning needed
              const stockWarning =
                selectedMedicine &&
                item.quantity > selectedMedicine.quantity / 2;

              return (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <select
                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                        value={item.medicineId || ""}
                        onChange={(e) =>
                          onMedicineChange(index, e.target.value)
                        }
                        disabled={disabled}
                      >
                        <option value="">Select Medicine</option>
                        {medicines.map((medicine) => (
                          <option
                            key={medicine.id}
                            value={medicine.id}
                            disabled={medicine.quantity <= 0}
                          >
                            {medicine.name}{" "}
                            {medicine.quantity <= 0 ? "(Out of Stock)" : ""}
                          </option>
                        ))}
                      </select>

                      {selectedMedicine && (
                        <div className="text-xs text-gray-500 mt-1">
                          In stock: {selectedMedicine.quantity} units | Default
                          price: ₹{selectedMedicine.defaultPrice.toFixed(2)}
                        </div>
                      )}

                      {!item.medicineId && (
                        <div className="text-xs text-orange-500 mt-1 flex items-center">
                          <AlertCircle size={12} className="mr-1" />
                          Please select a medicine
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <input
                        type="number"
                        className={`w-full p-2 border ${
                          stockWarning ? "border-orange-300" : "border-gray-300"
                        } rounded-md focus:outline-none focus:ring-1 focus:ring-primary`}
                        min="1"
                        max={selectedMedicine?.quantity || 999}
                        value={item.quantity}
                        onChange={(e) =>
                          onQuantityChange(index, e.target.value)
                        }
                        disabled={disabled || !item.medicineId}
                      />

                      {stockWarning && selectedMedicine && (
                        <div className="text-xs text-orange-500 mt-1">
                          Low stock warning
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                        ₹
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full p-2 pl-6 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                        min="0"
                        value={item.price}
                        onChange={(e) => onPriceChange(index, e.target.value)}
                        disabled={disabled || !item.medicineId}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <input
                        type="number"
                        className="w-full p-2 pr-6 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                        min="0"
                        max="100"
                        value={item.discount}
                        onChange={(e) =>
                          onDiscountChange(index, e.target.value)
                        }
                        disabled={disabled || !item.medicineId}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                        %
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    ₹
                    {calculateItemTotal(
                      item.price,
                      item.quantity,
                      item.discount
                    ).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      className={`p-1.5 rounded-full bg-gray-100 border-none transition-colors duration-200 ${
                        disabled || items.length === 1
                          ? "text-gray-400 cursor-not-allowed"
                          : "text-red-600 hover:bg-red-100"
                      }`}
                      onClick={() => onRemoveItem(index)}
                      disabled={disabled || items.length === 1}
                      title={
                        items.length === 1
                          ? "Cannot remove the last item"
                          : "Remove item"
                      }
                    >
                      <Trash2
                        size={14}
                        opacity={disabled || items.length === 1 ? 0.5 : 1}
                      />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center"
        onClick={onAddItem}
        disabled={disabled || medicines.length === 0}
      >
        <Plus size={16} className="mr-1.5" /> Add Medicine
      </button>

      {/* Helpful instructions */}
      <div className="mt-3 text-sm text-gray-500 bg-gray-50 p-3 rounded-md border border-gray-200">
        <p>
          Select medicines from the dropdown menu. Price will be automatically
          populated based on the selected medicine.
        </p>
      </div>
    </div>
  );
};

export default BillingItemsTable;