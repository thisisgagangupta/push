import React from "react";

const BillingToast = ({
  patientId,
  onProceedToBilling,
  toastId,
  onDismiss,
}) => {
  return (
    <div className="flex flex-col">
      <div className="text-gray-800 font-medium">
        Patient info saved successfully!
      </div>
      <div className="text-gray-600 text-sm mb-2">
        Patient ID: <span className="font-semibold">{patientId}</span>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={onProceedToBilling}
          className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-md transition-colors duration-200 flex items-center"
        >
          Proceed to Billing
        </button>
        <button
          onClick={() => onDismiss(toastId)}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-md transition-colors duration-200"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default BillingToast;
