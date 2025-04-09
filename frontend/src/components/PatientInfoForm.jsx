import { useState } from "react";
import { User, Search, Loader2 } from "lucide-react";

const PatientInfoForm = ({
  patientInfo,
  setPatientInfo,
  fetchPatientInfo,
  patientLoading,
  patientError,
  setPatientError,
  disabled = false,
}) => {
  const [patientId, setPatientId] = useState("");

  const handleFetchClick = () => {
    if (patientId.trim()) {
      fetchPatientInfo(patientId);
    } else {
      setPatientError("Please enter a Patient ID");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setPatientInfo({ ...patientInfo, [name]: value });

    // Clear any previous error when user starts editing
    if (patientError) {
      setPatientError(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-primary/10 p-1.5 rounded-full">
          <User size={16} className="text-primary" />
        </div>
        <h3 className="text-base font-medium">Patient Information</h3>
      </div>

      {patientError && (
        <div className="bg-red-100 border border-red-200 text-red-700 px-4 py-2 rounded-md mb-4">
          {patientError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Patient ID Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Patient ID (Optional)
          </label>
          <div className="flex">
            <input
              type="text"
              className="flex-1 p-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Enter ID to fetch details"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              disabled={disabled || patientLoading}
            />
            <button
              className="px-3 py-2 bg-primary text-white rounded-r-md rounded-l-none hover:bg-primary/90 disabled:opacity-50"
              onClick={handleFetchClick}
              disabled={disabled || patientLoading || !patientId.trim()}
            >
              {patientLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Search size={16} />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Enter ID or fill details manually
          </p>
        </div>

        {/* Patient Name */}
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Name*
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Patient name"
            value={patientInfo.name}
            onChange={handleChange}
            disabled={disabled || patientLoading}
          />
        </div>

        {/* Patient Age */}
        <div>
          <label
            htmlFor="age"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Age
          </label>
          <input
            type="number"
            id="age"
            name="age"
            min="0"
            max="120"
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Age"
            value={patientInfo.age}
            onChange={handleChange}
            disabled={disabled || patientLoading}
          />
        </div>

        {/* Patient Gender */}
        <div>
          <label
            htmlFor="gender"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Gender
          </label>
          <select
            id="gender"
            name="gender"
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            value={patientInfo.gender}
            onChange={handleChange}
            disabled={disabled || patientLoading}
          >
            <option value="">Select gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Patient Phone */}
        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Phone*
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            required
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Contact number"
            value={patientInfo.phone}
            onChange={handleChange}
            disabled={disabled || patientLoading}
          />
        </div>
      </div>
    </div>
  );
};

export default PatientInfoForm;