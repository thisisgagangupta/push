import React, { useEffect } from "react";
import { Trash2, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";

const MobileBillingView = ({
  items,
  medicines = [],
  onMedicineChange,
  onQuantityChange,
  onPriceChange,
  onDiscountChange,
  onRemoveItem,
  onAddItem,
  calculateItemTotal,
  disabled = false,
}) => {
  const [expandedItem, setExpandedItem] = React.useState(0);
  const [validationErrors, setValidationErrors] = React.useState([]);
  const [formTouched, setFormTouched] = React.useState(false);
  const [touchedFields, setTouchedFields] = React.useState(
    items.map(() => ({}))
  );

  // Update touchedFields when items length changes
  useEffect(() => {
    setTouchedFields((prev) => {
      if (prev.length !== items.length) {
        return items.map((_, i) => prev[i] || {});
      }
      return prev;
    });
  }, [items.length]);

  // Check for validation errors in all items
  useEffect(() => {
    const errors = items.map((item, index) => {
      const itemErrors = {};

      // Only check fields that have been touched or if form was submitted
      if ((touchedFields[index]?.medicineId || formTouched) && !item.medicineId)
        itemErrors.medicineId = true;
      if ((touchedFields[index]?.quantity || formTouched) && item.quantity < 1)
        itemErrors.quantity = true;
      if ((touchedFields[index]?.price || formTouched) && item.price <= 0)
        itemErrors.price = true;

      return Object.keys(itemErrors).length > 0 ? itemErrors : null;
    });

    setValidationErrors(errors);

    // Auto-expand the first item with errors if form was submitted and there are errors
    if (formTouched) {
      const firstErrorIndex = errors.findIndex((err) => err !== null);
      if (firstErrorIndex !== -1 && firstErrorIndex !== expandedItem) {
        setExpandedItem(firstErrorIndex);
      }
    }
  }, [items, touchedFields, formTouched, expandedItem]);

  const toggleItem = (index) => {
    setExpandedItem(expandedItem === index ? -1 : index);
  };

  // Helper to check if a field has an error
  const hasError = (itemIndex, fieldName) => {
    return (
      validationErrors[itemIndex] && validationErrors[itemIndex][fieldName]
    );
  };

  // Mark a field as touched when user interacts with it
  const markFieldAsTouched = (itemIndex, fieldName) => {
    const newTouchedFields = [...touchedFields];
    if (!newTouchedFields[itemIndex]) {
      newTouchedFields[itemIndex] = {};
    }
    newTouchedFields[itemIndex][fieldName] = true;
    setTouchedFields(newTouchedFields);
  };

  if (disabled) {
    return (
      <div className="p-4 bg-gray-100 rounded-lg">
        <p className="text-center text-gray-500">Billing is complete.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => {
        const price = item.price || 0;
        const quantity = item.quantity || 1;
        const discount = item.discount || 0;
        const totalForItem = calculateItemTotal(price, quantity, discount);
        const isExpanded = expandedItem === index;
        const hasErrors = formTouched && validationErrors[index] !== null;

        // Find the medicine object for this item to check availability
        const selectedMedicine = medicines.find(
          (m) => m.id === parseInt(item.medicineId)
        );
        const inStock = selectedMedicine && selectedMedicine.quantity > 0;
        const stockWarning =
          selectedMedicine && selectedMedicine.quantity < quantity;

        return (
          <div
            key={index}
            className={`border ${
              hasErrors ? "border-red-500" : "border-gray-300"
            } rounded-lg overflow-hidden bg-white shadow-sm`}
          >
            {/* Header - Always visible */}
            <div
              className={`flex items-center justify-between p-3 cursor-pointer ${
                hasErrors ? "bg-red-50" : "bg-gray-50"
              }`}
              onClick={() => toggleItem(index)}
            >
              <div className="flex-1">
                <div className="font-medium">
                  {item.name || "Select a medicine"}
                  {hasErrors && !item.medicineId && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  Qty: {quantity}
                  {stockWarning && (
                    <span className="text-orange-500 ml-1">(Low stock)</span>
                  )}
                  {selectedMedicine && (
                    <span className="text-xs text-gray-500 ml-1">
                      (Available: {selectedMedicine.quantity})
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right mr-2">
                <div className="font-semibold">₹{totalForItem.toFixed(2)}</div>
                {discount > 0 && (
                  <div className="text-xs text-red-500">-{discount}%</div>
                )}
              </div>
              <div className="flex items-center">
                {hasErrors && (
                  <AlertCircle size={16} className="text-red-500 mr-1" />
                )}
                {isExpanded ? (
                  <ChevronUp size={18} />
                ) : (
                  <ChevronDown size={18} />
                )}
              </div>
            </div>

            {/* Expandable content */}
            {isExpanded && (
              <div className="p-3 border-t border-gray-200 bg-white animate-[slideDown_0.2s_ease-out]">
                <div className="space-y-3">
                  {/* Medicine selection */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Medicine <span className="text-red-500">*</span>
                    </label>
                    <select
                      className={`w-full p-2 text-sm bg-white border ${
                        hasError(index, "medicineId")
                          ? "border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:ring-blue-500"
                      } rounded-lg focus:outline-none focus:ring-2`}
                      value={item.medicineId || ""}
                      onChange={(e) => {
                        onMedicineChange(index, e.target.value);
                        markFieldAsTouched(index, "medicineId");
                      }}
                      onBlur={() => markFieldAsTouched(index, "medicineId")}
                      required
                    >
                      <option value="">Select medicine</option>
                      {medicines.map((medicine) => (
                        <option
                          key={medicine.id}
                          value={medicine.id}
                          disabled={medicine.quantity <= 0}
                        >
                          {medicine.name}{" "}
                          {medicine.quantity <= 0
                            ? "(Out of Stock)"
                            : `(In Stock: ${medicine.quantity})`}
                        </option>
                      ))}
                    </select>
                    {hasError(index, "medicineId") && (
                      <p className="text-xs text-red-500 mt-1">
                        Medicine selection is required
                      </p>
                    )}
                    {!hasError(index, "medicineId") && item.medicineId && (
                      <p className="text-xs text-gray-500 mt-1">
                        Select medicine from your inventory
                      </p>
                    )}
                  </div>

                  {/* Quantity and Price - side by side */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Quantity <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          className={`w-full p-2 text-sm bg-white border ${
                            hasError(index, "quantity")
                              ? "border-red-500 focus:ring-red-500"
                              : "border-gray-300 focus:ring-blue-500"
                          } rounded-lg focus:outline-none focus:ring-2`}
                          value={quantity}
                          onChange={(e) => {
                            onQuantityChange(index, e.target.value);
                            markFieldAsTouched(index, "quantity");
                          }}
                          onBlur={() => markFieldAsTouched(index, "quantity")}
                        />
                      </div>
                      {hasError(index, "quantity") && (
                        <p className="text-xs text-red-500 mt-1">
                          Quantity must be at least 1
                        </p>
                      )}
                      {stockWarning && (
                        <p className="text-xs text-orange-500 mt-1">
                          Only {selectedMedicine.quantity} available
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Price <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                          ₹
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          className={`w-full p-2 pl-6 text-sm bg-white border ${
                            hasError(index, "price")
                              ? "border-red-500 focus:ring-red-500"
                              : "border-gray-300 focus:ring-blue-500"
                          } rounded-lg focus:outline-none focus:ring-2`}
                          value={price}
                          onChange={(e) => {
                            onPriceChange(index, e.target.value);
                            markFieldAsTouched(index, "price");
                          }}
                          onBlur={() => markFieldAsTouched(index, "price")}
                        />
                      </div>
                      {hasError(index, "price") && (
                        <p className="text-xs text-red-500 mt-1">
                          Price must be greater than 0
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Discount */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Discount (Optional)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="w-full p-2 pr-6 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={discount}
                        onChange={(e) =>
                          onDiscountChange(index, e.target.value)
                        }
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                        %
                      </span>
                    </div>
                  </div>

                  {/* Remove button */}
                  <div className="pt-1">
                    <button
                      type="button"
                      className={`w-full p-2 rounded-lg bg-gray-100 border text-center transition-colors duration-200 ${
                        items.length === 1
                          ? "border-gray-200 text-gray-400 cursor-not-allowed"
                          : "border-red-300 text-red-600 hover:bg-red-50"
                      }`}
                      onClick={() => onRemoveItem(index)}
                      disabled={items.length === 1}
                    >
                      <Trash2 size={16} className="inline-block mr-2" />
                      Remove Medicine
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add button */}
      <button
        type="button"
        className="w-full py-3 bg-gray-100 text-gray-900 hover:bg-gray-200 border-none outline-none rounded-lg flex items-center justify-center transition-colors duration-200"
        onClick={onAddItem}
      >
        + Add Medicine
      </button>

      {/* Price summary - this is handled in the parent component */}
    </div>
  );
};

export default MobileBillingView;