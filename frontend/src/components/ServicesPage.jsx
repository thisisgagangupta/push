// import React, { useState, useEffect } from "react";
// import { Pencil, Trash, Loader } from "lucide-react";
// import axios from "axios";

// // Base URL for API requests
// // const API_BASE_URL = "http://localhost:5000";
// const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// const ServicesPage = () => {
//   // State for services
//   const [services, setServices] = useState([]);

//   // State for form inputs
//   const [newServiceName, setNewServiceName] = useState("");
//   const [newServicePrice, setNewServicePrice] = useState("");

//   // State for edit dialog
//   const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
//   const [currentService, setCurrentService] = useState(null);
//   const [editName, setEditName] = useState("");
//   const [editPrice, setEditPrice] = useState("");

//   // Loading states
//   const [isLoading, setIsLoading] = useState(true);
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [isDeleting, setIsDeleting] = useState({});
//   const [isUpdating, setIsUpdating] = useState(false);

//   // Error state
//   const [error, setError] = useState(null);

//   // Fetch all services on component mount
//   useEffect(() => {
//     fetchServices();
//   }, []);

//   // Function to fetch all services
//   const fetchServices = async () => {
//     setIsLoading(true);
//     setError(null);

//     try {
//       const response = await axios.get(`${API_BASE_URL}/api/services`);
//       setServices(response.data);
//     } catch (err) {
//       console.error("Error fetching services:", err);
//       setError("Failed to load services. Please try again later.");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   // Add new service
//   const handleAddService = async () => {
//     if (newServiceName.trim() === "" || newServicePrice === "") return;

//     setIsSubmitting(true);
//     setError(null);

//     try {
//       const response = await axios.post(`${API_BASE_URL}/api/services`, {
//         name: newServiceName,
//         default_price: Number(newServicePrice),
//       });

//       setServices([...services, response.data]);
//       setNewServiceName("");
//       setNewServicePrice("");
//     } catch (err) {
//       console.error("Error adding service:", err);
//       setError("Failed to add service. Please try again.");
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   // Delete service
//   const handleDeleteService = async (id) => {
//     setIsDeleting((prev) => ({ ...prev, [id]: true }));
//     setError(null);

//     try {
//       await axios.delete(`${API_BASE_URL}/api/services/${id}`);
//       setServices(services.filter((service) => service.id !== id));
//     } catch (err) {
//       console.error("Error deleting service:", err);
//       setError("Failed to delete service. Please try again.");
//     } finally {
//       setIsDeleting((prev) => ({ ...prev, [id]: false }));
//     }
//   };

//   // Open edit dialog
//   const openEditDialog = (service) => {
//     setCurrentService(service);
//     setEditName(service.name);
//     setEditPrice(service.default_price.toString());
//     setIsEditDialogOpen(true);
//   };

//   // Update service
//   const handleUpdateService = async () => {
//     if (editName.trim() === "" || editPrice === "") return;

//     setIsUpdating(true);
//     setError(null);

//     try {
//       const response = await axios.put(
//         `${API_BASE_URL}/api/services/${currentService.id}`,
//         {
//           name: editName,
//           default_price: Number(editPrice),
//         }
//       );

//       const updatedServices = services.map((service) =>
//         service.id === currentService.id ? response.data : service
//       );

//       setServices(updatedServices);
//       setIsEditDialogOpen(false);
//     } catch (err) {
//       console.error("Error updating service:", err);
//       setError("Failed to update service. Please try again.");
//     } finally {
//       setIsUpdating(false);
//     }
//   };

//   return (
//     <div className="w-screen min-h-screen flex justify-center p-2">
//       <div className="bg-gray-50 max-w-screen-xl w-full h-fit p-4 md:p-6 rounded-lg shadow-xl">
//         <h1 className="text-2xl md:text-3xl font-bold mb-6 text-center">
//           Services Management
//         </h1>

//         {/* Error display */}
//         {error && (
//           <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
//             <p>{error}</p>
//           </div>
//         )}

//         {/* Add Service Form */}
//         <div className="bg-white p-4 rounded-md shadow mb-6">
//           <div className="flex flex-col md:flex-row gap-3">
//             <div className="flex-1">
//               <label
//                 htmlFor="serviceName"
//                 className="block text-sm font-medium text-gray-700 mb-1"
//               >
//                 Service Name
//               </label>
//               <input
//                 type="text"
//                 id="serviceName"
//                 className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                 placeholder="Enter service name"
//                 value={newServiceName}
//                 onChange={(e) => setNewServiceName(e.target.value)}
//                 disabled={isSubmitting}
//               />
//             </div>
//             <div className="flex-1">
//               <label
//                 htmlFor="servicePrice"
//                 className="block text-sm font-medium text-gray-700 mb-1"
//               >
//                 Default Price (₹)
//               </label>
//               <input
//                 type="number"
//                 id="servicePrice"
//                 className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                 placeholder="Enter price"
//                 value={newServicePrice}
//                 onChange={(e) => setNewServicePrice(e.target.value)}
//                 disabled={isSubmitting}
//               />
//             </div>
//             <div className="flex items-end">
//               <button
//                 className={`bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors w-full md:w-auto ${
//                   isSubmitting ? "opacity-70 cursor-not-allowed" : ""
//                 }`}
//                 onClick={handleAddService}
//                 disabled={isSubmitting}
//               >
//                 {isSubmitting ? (
//                   <span className="flex items-center justify-center">
//                     <Loader size={18} className="animate-spin mr-2" />
//                     Adding...
//                   </span>
//                 ) : (
//                   "Add Service"
//                 )}
//               </button>
//             </div>
//           </div>
//         </div>

//         {/* Loading state */}
//         {isLoading ? (
//           <div className="flex justify-center items-center py-20">
//             <Loader size={40} className="text-blue-600 animate-spin" />
//           </div>
//         ) : (
//           <>
//             {/* Services List */}
//             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
//               {services.map((service) => (
//                 <div
//                   key={service.id}
//                   className="bg-white p-4 rounded-md shadow hover:shadow-md transition-shadow"
//                 >
//                   <div className="flex justify-between items-start">
//                     <div>
//                       <h3 className="font-medium text-lg text-gray-800">
//                         {service.name}
//                       </h3>
//                       <p className="text-gray-600 mt-1">
//                         ₹{service.default_price.toFixed(2)}
//                       </p>
//                     </div>
//                     <div className="flex space-x-2">
//                       <button
//                         className="p-1 hover:bg-gray-100 bg-transparent rounded-full"
//                         onClick={() => openEditDialog(service)}
//                         disabled={isDeleting[service.id]}
//                       >
//                         <Pencil size={18} className="text-blue-600" />
//                       </button>
//                       <button
//                         className="p-1 hover:border-red-600 hover:bg-gray-100 bg-transparent rounded-full"
//                         onClick={() => handleDeleteService(service.id)}
//                         disabled={isDeleting[service.id]}
//                       >
//                         {isDeleting[service.id] ? (
//                           <Loader
//                             size={18}
//                             className="text-red-600 animate-spin"
//                           />
//                         ) : (
//                           <Trash size={18} className="text-red-600" />
//                         )}
//                       </button>
//                     </div>
//                   </div>
//                 </div>
//               ))}
//             </div>

//             {/* Empty state */}
//             {services.length === 0 && !isLoading && (
//               <div className="text-center py-10">
//                 <p className="text-gray-500">
//                   No services available. Add your first service above.
//                 </p>
//               </div>
//             )}
//           </>
//         )}

//         {/* Edit Dialog */}
//         {isEditDialogOpen && (
//           <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
//             <div className="bg-white rounded-lg p-6 w-full max-w-md">
//               <h2 className="text-xl font-bold mb-4">Edit Service</h2>
//               <div className="space-y-4">
//                 <div>
//                   <label
//                     htmlFor="editName"
//                     className="block text-sm font-medium text-gray-700 mb-1"
//                   >
//                     Service Name
//                   </label>
//                   <input
//                     type="text"
//                     id="editName"
//                     className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                     value={editName}
//                     onChange={(e) => setEditName(e.target.value)}
//                     disabled={isUpdating}
//                   />
//                 </div>
//                 <div>
//                   <label
//                     htmlFor="editPrice"
//                     className="block text-sm font-medium text-gray-700 mb-1"
//                   >
//                     Price (₹)
//                   </label>
//                   <input
//                     type="number"
//                     id="editPrice"
//                     className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                     value={editPrice}
//                     onChange={(e) => setEditPrice(e.target.value)}
//                     disabled={isUpdating}
//                   />
//                 </div>
//                 <div className="flex gap-3 justify-end">
//                   <button
//                     className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
//                     onClick={() => setIsEditDialogOpen(false)}
//                     disabled={isUpdating}
//                   >
//                     Cancel
//                   </button>
//                   <button
//                     className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors ${
//                       isUpdating ? "opacity-70 cursor-not-allowed" : ""
//                     }`}
//                     onClick={handleUpdateService}
//                     disabled={isUpdating}
//                   >
//                     {isUpdating ? (
//                       <span className="flex items-center justify-center">
//                         <Loader size={16} className="animate-spin mr-2" />
//                         Updating...
//                       </span>
//                     ) : (
//                       "Update"
//                     )}
//                   </button>
//                 </div>
//               </div>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default ServicesPage;






import React, { useState, useEffect } from "react";
import { Pencil, Trash, Loader } from "lucide-react";
import axios from "axios";

// Base URL for API requests
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const ServicesPage = () => {
  // State for services
  const [services, setServices] = useState([]);

  // State for form inputs
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");

  // NEW: Add a checkbox for requires_time
  const [newServiceRequiresTime, setNewServiceRequiresTime] = useState(false);

  // State for edit dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentService, setCurrentService] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  // NEW: Keep track of editing requires_time
  const [editRequiresTime, setEditRequiresTime] = useState(false);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);

  // Error state
  const [error, setError] = useState(null);

  // Fetch all services on component mount
  useEffect(() => {
    fetchServices();
  }, []);

  // Function to fetch all services
  const fetchServices = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${API_BASE_URL}/api/services`);
      setServices(response.data);
    } catch (err) {
      console.error("Error fetching services:", err);
      setError("Failed to load services. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  // Add new service
  const handleAddService = async () => {
    if (newServiceName.trim() === "" || newServicePrice === "") return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Include requires_time in the payload
      const response = await axios.post(`${API_BASE_URL}/api/services`, {
        name: newServiceName,
        default_price: Number(newServicePrice),
        requires_time: newServiceRequiresTime,
      });

      setServices([...services, response.data]);
      setNewServiceName("");
      setNewServicePrice("");
      setNewServiceRequiresTime(false); // reset
    } catch (err) {
      console.error("Error adding service:", err);
      setError("Failed to add service. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete service
  const handleDeleteService = async (id) => {
    setIsDeleting((prev) => ({ ...prev, [id]: true }));
    setError(null);

    try {
      await axios.delete(`${API_BASE_URL}/api/services/${id}`);
      setServices(services.filter((service) => service.id !== id));
    } catch (err) {
      console.error("Error deleting service:", err);
      setError("Failed to delete service. Please try again.");
    } finally {
      setIsDeleting((prev) => ({ ...prev, [id]: false }));
    }
  };

  // Open edit dialog
  const openEditDialog = (service) => {
    setCurrentService(service);
    setEditName(service.name);
    setEditPrice(service.default_price.toString());

    // NEW: set editRequiresTime from the service
    setEditRequiresTime(!!service.requires_time);

    setIsEditDialogOpen(true);
  };

  // Update service
  const handleUpdateService = async () => {
    if (editName.trim() === "" || editPrice === "") return;

    setIsUpdating(true);
    setError(null);

    try {
      // Include requires_time in the PUT payload
      const response = await axios.put(
        `${API_BASE_URL}/api/services/${currentService.id}`,
        {
          name: editName,
          default_price: Number(editPrice),
          requires_time: editRequiresTime,
        }
      );

      const updatedServices = services.map((service) =>
        service.id === currentService.id ? response.data : service
      );

      setServices(updatedServices);
      setIsEditDialogOpen(false);
    } catch (err) {
      console.error("Error updating service:", err);
      setError("Failed to update service. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="w-screen min-h-screen flex justify-center p-2">
      <div className="bg-gray-50 max-w-screen-xl w-full h-fit p-4 md:p-6 rounded-lg shadow-xl">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 text-center">
          Services Management
        </h1>

        {/* Error display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p>{error}</p>
          </div>
        )}

        {/* Add Service Form */}
        <div className="bg-white p-4 rounded-md shadow mb-6">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <label
                htmlFor="serviceName"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Service Name
              </label>
              <input
                type="text"
                id="serviceName"
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter service name"
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="flex-1">
              <label
                htmlFor="servicePrice"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Default Price (₹)
              </label>
              <input
                type="number"
                id="servicePrice"
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter price"
                value={newServicePrice}
                onChange={(e) => setNewServicePrice(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* NEW: requires_time checkbox */}
          <div className="mt-3">
            <label className="inline-flex items-center space-x-2">
              <input
                type="checkbox"
                checked={newServiceRequiresTime}
                onChange={(e) => setNewServiceRequiresTime(e.target.checked)}
                disabled={isSubmitting}
              />
              <span>Requires Appointment (Date/Time/Duration)?</span>
            </label>
          </div>

          <div className="flex items-end mt-3">
            <button
              className={`bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors w-full md:w-auto ${
                isSubmitting ? "opacity-70 cursor-not-allowed" : ""
              }`}
              onClick={handleAddService}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <Loader size={18} className="animate-spin mr-2" />
                  Adding...
                </span>
              ) : (
                "Add Service"
              )}
            </button>
          </div>
        </div>

        {/* Loading state */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader size={40} className="text-blue-600 animate-spin" />
          </div>
        ) : (
          <>
            {/* Services List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="bg-white p-4 rounded-md shadow hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-lg text-gray-800">
                        {service.name}
                      </h3>
                      <p className="text-gray-600 mt-1">
                        ₹{service.default_price.toFixed(2)}
                      </p>
                      {/* NEW: show if service requires time */}
                      {service.requires_time && (
                        <p className="text-sm text-green-700 mt-2">
                          Requires Appointment
                        </p>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        className="p-1 hover:bg-gray-100 bg-transparent rounded-full"
                        onClick={() => openEditDialog(service)}
                        disabled={isDeleting[service.id]}
                      >
                        <Pencil size={18} className="text-blue-600" />
                      </button>
                      <button
                        className="p-1 hover:border-red-600 hover:bg-gray-100 bg-transparent rounded-full"
                        onClick={() => handleDeleteService(service.id)}
                        disabled={isDeleting[service.id]}
                      >
                        {isDeleting[service.id] ? (
                          <Loader
                            size={18}
                            className="text-red-600 animate-spin"
                          />
                        ) : (
                          <Trash size={18} className="text-red-600" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Empty state */}
            {services.length === 0 && !isLoading && (
              <div className="text-center py-10">
                <p className="text-gray-500">
                  No services available. Add your first service above.
                </p>
              </div>
            )}
          </>
        )}

        {/* Edit Dialog */}
        {isEditDialogOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Edit Service</h2>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="editName"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Service Name
                  </label>
                  <input
                    type="text"
                    id="editName"
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    disabled={isUpdating}
                  />
                </div>
                <div>
                  <label
                    htmlFor="editPrice"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    id="editPrice"
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    disabled={isUpdating}
                  />
                </div>

                {/* NEW: Edit requires_time */}
                <div>
                  <label className="inline-flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={editRequiresTime}
                      onChange={(e) => setEditRequiresTime(e.target.checked)}
                      disabled={isUpdating}
                    />
                    <span>Requires Appointment (Date/Time/Duration)?</span>
                  </label>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                    onClick={() => setIsEditDialogOpen(false)}
                    disabled={isUpdating}
                  >
                    Cancel
                  </button>
                  <button
                    className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors ${
                      isUpdating ? "opacity-70 cursor-not-allowed" : ""
                    }`}
                    onClick={handleUpdateService}
                    disabled={isUpdating}
                  >
                    {isUpdating ? (
                      <span className="flex items-center justify-center">
                        <Loader size={16} className="animate-spin mr-2" />
                        Updating...
                      </span>
                    ) : (
                      "Update"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServicesPage;
