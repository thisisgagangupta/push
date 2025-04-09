import React, { useEffect } from "react";
import {
  Trash2,
  ChevronDown,
  ChevronUp,
  IndianRupee,
  AlertCircle,
  Loader2,
} from "lucide-react";

const BillingMobileView = ({
  rows,
  services = [],
  doctors = [],
  handleServiceChange,
  handlePriceChange,
  handleDiscountChange,
  handleDoctorChange,
  handleDateChange,
  handleTimeChange,
  handleDurationChange,
  removeRow,
  calculateItemTotal,
  calculateTotal,
  handleClose,
  addRow,
  onSubmit,
  setPaymentMode,
  setPaymentStatus,
  paymentMode,
  paymentStatus,
  loading = false,
  submitting = false,
}) => {
  const [expandedRow, setExpandedRow] = React.useState(0);
  const [validationErrors, setValidationErrors] = React.useState([]);
  const [formTouched, setFormTouched] = React.useState(false);
  const [touchedFields, setTouchedFields] = React.useState(rows.map(() => ({})));

  useEffect(() => {
    // Keep touchedFields array in sync with row length
    setTouchedFields((prev) => {
      if (prev.length !== rows.length) {
        return rows.map((_, i) => prev[i] || {});
      }
      return prev;
    });
  }, [rows.length]);

  useEffect(() => {
    const errors = rows.map((row, index) => {
      const rowErrors = {};
      const selectedService = services.find((s) => s.name === row.service);
      const requiresTime = selectedService?.requires_time === true;

      if ((touchedFields[index]?.service || formTouched) && !row.service)
        rowErrors.service = true;
      if ((touchedFields[index]?.doctor || formTouched) && !row.doctor)
        rowErrors.doctor = true;

      if (requiresTime) {
        if (
          (touchedFields[index]?.appointmentDate || formTouched) &&
          !row.appointmentDate
        ) {
          rowErrors.appointmentDate = true;
        }
        if (
          (touchedFields[index]?.appointmentTime || formTouched) &&
          !row.appointmentTime
        ) {
          rowErrors.appointmentTime = true;
        }
      }

      return Object.keys(rowErrors).length > 0 ? rowErrors : null;
    });

    setValidationErrors(errors);

    // If the form was fully touched, auto-expand first row with errors
    if (formTouched) {
      const firstErrorIndex = errors.findIndex((err) => err !== null);
      if (firstErrorIndex !== -1 && firstErrorIndex !== expandedRow) {
        setExpandedRow(firstErrorIndex);
      }
    }
  }, [rows, touchedFields, formTouched, expandedRow, services]);

  const toggleRow = (index) => {
    setExpandedRow(expandedRow === index ? -1 : index);
  };

  const hasError = (rowIndex, fieldName) => {
    return validationErrors[rowIndex] && validationErrors[rowIndex][fieldName];
  };

  const markFieldAsTouched = (rowIndex, fieldName) => {
    const newTouchedFields = [...touchedFields];
    if (!newTouchedFields[rowIndex]) {
      newTouchedFields[rowIndex] = {};
    }
    newTouchedFields[rowIndex][fieldName] = true;
    setTouchedFields(newTouchedFields);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormTouched(true);
    const hasErrors = validationErrors.some((error) => error !== null);

    if (!hasErrors && onSubmit) {
      onSubmit(rows);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Loader2 size={36} className="text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading services...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((row, index) => {
        const price = row.price || 0;
        const discount = row.discount || 0;
        const totalForRow = calculateItemTotal(price, discount);
        const isExpanded = expandedRow === index;
        const hasErrors = formTouched && validationErrors[index] !== null;

        const selectedService = services.find((s) => s.name === row.service);
        const requiresTime = selectedService?.requires_time === true;

        return (
          <div
            key={index}
            className={`border ${
              hasErrors ? "border-destructive" : "border-border"
            } rounded-lg overflow-hidden bg-white shadow-sm`}
          >
            <div
              className={`flex items-center justify-between p-3 cursor-pointer ${
                hasErrors ? "bg-destructive/10" : "bg-secondary/20"
              }`}
              onClick={() => toggleRow(index)}
            >
              <div className="flex-1">
                <div className="font-medium">
                  {row.service || "Select a service"}
                  {hasErrors && !row.service && (
                    <span className="text-destructive ml-1">*</span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {row.doctor || "Select doctor"} •{" "}
                  {row.appointmentDate
                    ? new Date(row.appointmentDate).toLocaleDateString()
                    : "No date"}
                  {hasErrors && (!row.doctor || !row.appointmentDate) && (
                    <span className="text-destructive ml-1">*</span>
                  )}
                </div>
              </div>
              <div className="text-right mr-2">
                <div className="font-semibold">₹{totalForRow.toFixed(2)}</div>
                {discount > 0 && (
                  <div className="text-xs text-destructive">-{discount}%</div>
                )}
              </div>
              <div className="flex items-center">
                {hasErrors && (
                  <AlertCircle size={16} className="text-destructive mr-1" />
                )}
                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </div>

            {isExpanded && (
              <div className="p-3 border-t border-border bg-background animate-slide-down">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Service <span className="text-destructive">*</span>
                    </label>
                    <select
                      className={`w-full p-2 text-sm bg-background border ${
                        hasError(index, "service")
                          ? "border-destructive focus:ring-destructive"
                          : "border-input focus:ring-ring"
                      } rounded-lg focus:outline-none focus:ring-2 focus:border-input`}
                      value={row.service || ""}
                      onChange={(e) => {
                        handleServiceChange(index, e.target.value);
                        markFieldAsTouched(index, "service");
                      }}
                      onBlur={() => markFieldAsTouched(index, "service")}
                      required
                      disabled={submitting}
                    >
                      <option value="">Select a service</option>
                      {services.map((service) => (
                        <option key={service.name} value={service.name}>
                          {service.name}
                        </option>
                      ))}
                    </select>
                    {hasError(index, "service") && (
                      <p className="text-xs text-destructive mt-1">
                        Service is required
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Doctor <span className="text-destructive">*</span>
                    </label>
                    <select
                      className={`w-full p-2 text-sm bg-background border ${
                        hasError(index, "doctor")
                          ? "border-destructive focus:ring-destructive"
                          : "border-input focus:ring-ring"
                      } rounded-lg focus:outline-none focus:ring-2 focus:border-input`}
                      value={row.doctor || ""}
                      onChange={(e) => {
                        handleDoctorChange(index, e.target.value);
                        markFieldAsTouched(index, "doctor");
                      }}
                      onBlur={() => markFieldAsTouched(index, "doctor")}
                      required
                      disabled={submitting}
                    >
                      <option value="">Select a doctor</option>
                      {doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.name}>
                          {doctor.name}
                        </option>
                      ))}
                    </select>
                    {hasError(index, "doctor") && (
                      <p className="text-xs text-destructive mt-1">
                        Doctor is required
                      </p>
                    )}
                  </div>

                  {/* Show date/time if requires_time===true, else "N/A" */}
                  {requiresTime && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Date <span className="text-destructive">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          className={`w-full p-2 text-sm bg-background border ${
                            hasError(index, "appointmentDate")
                              ? "border-destructive focus:ring-destructive"
                              : "border-input focus:ring-ring"
                          } rounded-lg focus:outline-none focus:ring-2 focus:border-input`}
                          value={row.appointmentDate || ""}
                          onChange={(e) => {
                            handleDateChange(index, e.target.value);
                            markFieldAsTouched(index, "appointmentDate");
                          }}
                          onBlur={() =>
                            markFieldAsTouched(index, "appointmentDate")
                          }
                          disabled={submitting}
                        />
                        {hasError(index, "appointmentDate") && (
                          <p className="text-xs text-destructive mt-1">
                            Date is required
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Time <span className="text-destructive">*</span>
                        </label>
                        <input
                          type="time"
                          required
                          className={`w-full p-2 text-sm bg-background border ${
                            hasError(index, "appointmentTime")
                              ? "border-destructive focus:ring-destructive"
                              : "border-input focus:ring-ring"
                          } rounded-lg focus:outline-none focus:ring-2 focus:border-input`}
                          value={row.appointmentTime || ""}
                          onChange={(e) => {
                            handleTimeChange(index, e.target.value);
                            markFieldAsTouched(index, "appointmentTime");
                          }}
                          onBlur={() =>
                            markFieldAsTouched(index, "appointmentTime")
                          }
                          disabled={submitting}
                        />
                        {hasError(index, "appointmentTime") && (
                          <p className="text-xs text-destructive mt-1">
                            Time is required
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {requiresTime && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Duration
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="15"
                            step="15"
                            className="w-full p-2 pr-8 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-input"
                            value={row.duration || 30}
                            onChange={(e) =>
                              handleDurationChange(index, e.target.value)
                            }
                            disabled={submitting}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                            min
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* If service doesn't require time, we just show "N/A" or nothing for date/time. */}
                  {!requiresTime && (
                    <div className="text-sm text-gray-500 border p-2 rounded-md">
                      <p>Date/Time not required for this service.</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Price
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          ₹
                        </span>
                        <input
                          type="number"
                          className="w-full p-2 pl-6 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-input"
                          value={price}
                          onChange={(e) => {
                            handlePriceChange(index, e.target.value);
                            markFieldAsTouched(index, "price");
                          }}
                          disabled={submitting}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Discount
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="w-full p-2 pr-6 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-input"
                          value={discount}
                          onChange={(e) =>
                            handleDiscountChange(index, e.target.value)
                          }
                          disabled={submitting}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          %
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      className={`w-full p-2 rounded-lg bg-gray-100 border text-center transition-colors duration-200 ${
                        rows.length === 1 || submitting
                          ? "border-gray-200 text-gray-400 cursor-not-allowed"
                          : "border-destructive/30 text-destructive hover:bg-destructive/10"
                      }`}
                      onClick={() => removeRow(index)}
                      disabled={rows.length === 1 || submitting}
                    >
                      <Trash2 size={16} className="inline-block mr-2" />
                      Remove Service
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        className="w-full py-3 bg-gray-100 text-gray-900 hover:bg-gray-200 border-none outline-none rounded-lg flex items-center justify-center transition-colors duration-200"
        onClick={addRow}
        disabled={submitting}
      >
        + Add Service
      </button>

      <div className="mt-6 p-4 rounded-xl border border-border bg-secondary/30">
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-primary/10 p-1.5 rounded-full">
            <IndianRupee size={16} className="text-primary" />
          </div>
          <h3 className="text-base font-medium">Price Summary</h3>
        </div>

        <div className="space-y-3 mb-6">
          {rows.map((row, index) => {
            const price = row.price || 0;
            const discount = row.discount || 0;
            const discountAmount = (price * discount) / 100;
            // const totalForRow = price - discountAmount;

            return (
              <div
                key={index}
                className="border-b border-border pb-3 last:border-0"
              >
                <div className="flex justify-between">
                  <span className="font-medium">
                    {row.service || "No service selected"}
                  </span>
                  <span>₹{price.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Discount ({discount}%)</span>
                    <span>-₹{discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  {row.doctor || "No doctor selected"} •{" "}
                  {row.appointmentDate
                    ? new Date(row.appointmentDate).toLocaleDateString()
                    : "No date"}
                  {row.appointmentTime ? ` at ${row.appointmentTime}` : ""}
                  {row.duration ? ` (${row.duration} min)` : ""}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border pt-3 flex justify-between items-center">
          <span className="font-medium">Total</span>
          <span className="text-xl font-semibold">
            ₹{calculateTotal().toFixed(2)}
          </span>
        </div>
      </div>

      <div className="bg-secondary/20 p-4 rounded-lg my-4 border border-border">
        <div className="space-y-3">
          <div className="flex flex-col">
            <label className="text-sm font-medium mb-1">Payment Mode</label>
            <select
              className="p-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring focus:border-input transition-all duration-200"
              defaultValue="cash"
              onChange={(e) => setPaymentMode(e.target.value)}
              value={paymentMode}
              disabled={submitting}
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
              <option value="insurance">Insurance</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium mb-1">Payment Status</label>
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

      <button
        type="button"
        className="w-full py-3 bg-primary text-white hover:bg-primary/90 border-none outline-none rounded-lg flex items-center justify-center transition-colors duration-200 mt-4"
        onClick={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Loader2 size={16} className="mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          "Complete Billing"
        )}
      </button>
      <button
        type="button"
        className="w-full py-3 bg-gray-300 text-gray-800 hover:bg-gray-400 border-none outline-none rounded-lg flex items-center justify-center transition-colors duration-200 mt-4"
        onClick={handleClose}
        disabled={submitting}
      >
        Cancel
      </button>
    </div>
  );
};

export default BillingMobileView;
