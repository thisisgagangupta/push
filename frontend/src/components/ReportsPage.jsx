import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend,
  LineChart, Line
} from "recharts";

import {
  Activity,
  DollarSign,
  User,
  LayoutGrid,
  Briefcase,
  CreditCard,
  Building2,
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function ReportPage() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [reportData, setReportData] = useState(null);

  // For toggling the monthly line chart between gender vs. age
  const [selectedTrend, setSelectedTrend] = useState("gender");

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    try {
      setLoading(true);
      setErrorMsg("");
      const resp = await fetch(`${API_BASE_URL}/api/reports`);
      if (!resp.ok) {
        throw new Error(`Fetch error: ${resp.status}`);
      }
      const json = await resp.json();
      if (!json.success) {
        throw new Error(json.error || "Unknown error from /api/reports");
      }
      setReportData(json.data);
    } catch (err) {
      console.error("Error fetching report data:", err);
      setErrorMsg("Failed to load report metrics.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <LoadingScreen />;
  }
  if (errorMsg) {
    return <ErrorScreen message={errorMsg} />;
  }

  // Destructure the data from the backend
  const {
    counts = {},
    genderRatio = {},
    ageDistribution = {},
    repeatVisits = {},
    monthlyFootfall = [],
    topDoctors = [],
    topServices = [],
    paymentModeDistribution = [],
    topDepartments = [],
    monthlyGenderTrend = [],
    monthlyAgeTrend = [],
    // NEW fields from your updated /api/reports endpoint:
    topDiagnosis = [],       // Array of { diagnosis, count }
    monthlyRevenue = [],     // Array of { month, revenue }
  } = reportData || {};

  // ----- Prepare data for existing charts -----

  // 1) Gender Pie
  const genderPieData = [
    { name: "Male", value: genderRatio.male || 0 },
    { name: "Female", value: genderRatio.female || 0 },
    { name: "Others", value: genderRatio.others || 0 },
  ];
  const genderColors = ["#8884d8", "#FF7F50", "#82ca9d"];

  // 2) Age Bar
  const ageBarData = [
    { range: "0-18", value: ageDistribution["0_18"] || 0 },
    { range: "19-30", value: ageDistribution["19_30"] || 0 },
    { range: "31-60", value: ageDistribution["31_60"] || 0 },
    { range: "61+", value: ageDistribution["61_plus"] || 0 },
  ];

  // 3) Payment Mode Pie
  const payModePieData = paymentModeDistribution.map((pm) => ({
    name: pm.mode,
    value: pm.count,
  }));
  const payModeColors = ["#0088FE", "#FFBB28", "#FF8042", "#00C49F", "#A084E8"];

  // 4) Top Departments Bar
  const deptBarData = topDepartments.map((d) => ({
    department: d.department,
    value: d.count,
  }));

  // 5) Monthly Footfall
  const footfallLineData = monthlyFootfall.map((item) => ({
    month: item.month,
    count: item.count,
  }));

  // 6) Toggled line chart data (monthlyGenderTrend vs monthlyAgeTrend)
  let lineChartData = [];
  let linesToRender = [];
  if (selectedTrend === "gender") {
    lineChartData = monthlyGenderTrend;
    linesToRender = [
      { dataKey: "male", stroke: "#8884d8", name: "Male" },
      { dataKey: "female", stroke: "#FF7F50", name: "Female" },
      { dataKey: "others", stroke: "#82ca9d", name: "Others" },
    ];
  } else {
    lineChartData = monthlyAgeTrend;
    linesToRender = [
      { dataKey: "age_0_18", stroke: "#8884d8", name: "0-18" },
      { dataKey: "age_19_30", stroke: "#FFBB28", name: "19-30" },
      { dataKey: "age_31_60", stroke: "#82ca9d", name: "31-60" },
      { dataKey: "age_61_plus", stroke: "#FF8042", name: "61+" },
    ];
  }

  // ----- Data for NEW charts: topDiagnosis, monthlyRevenue -----

  return (
    <div className="w-screen h-screen overflow-auto bg-gray-50 text-gray-800">
      {/* Page content wrapper */}
      <div className="px-4 py-6">
        {/* ====== Header Row: Title & Buttons ====== */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-primary">Reports Dashboard</h1>
          <div className="flex items-center space-x-3">
            <Link
              to="/appointments"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-black shadow transition-colors hover:bg-primary/90"
            >
              Appointments
            </Link>
            <Link
              to="/home"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-black shadow transition-colors hover:bg-primary/90"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {/* ====== KPI CARDS (4 boxes) ====== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard
            icon={<User className="h-5 w-5 text-primary" />}
            label="Total Patients"
            value={counts.totalPatients || 0}
          />
          <KpiCard
            icon={<Activity className="h-5 w-5 text-primary" />}
            label="Appointments"
            value={counts.totalAppointments || 0}
          />
          <KpiCard
            icon={<DollarSign className="h-5 w-5 text-primary" />}
            label="Total Revenue"
            value={`₹${(counts.totalRevenue || 0).toLocaleString()}`}
          />
          <KpiCard
            icon={<LayoutGrid className="h-5 w-5 text-primary" />}
            label="Unique Depts"
            value={topDepartments.length}
          />
        </div>

        {/* ====== GENDER + AGE + TOP DIAGNOSIS (3 columns) ====== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* GENDER PIE */}
          <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm">
            <h3 className="font-semibold mb-2">Gender Distribution</h3>
            <div className="w-full h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={genderPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {genderPieData.map((entry, idx) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={genderColors[idx % genderColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AGE BAR */}
          <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm">
            <h3 className="font-semibold mb-2">Age Distribution</h3>
            <div className="w-full h-72">
              <ResponsiveContainer>
                <BarChart data={ageBarData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#82ca9d" name="Patients" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* TOP DIAGNOSIS (TABLE) */}
          <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm">
            <h3 className="font-semibold mb-2">Top Diagnosis</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-2 px-3 text-left">Diagnosis</th>
                    <th className="py-2 px-3 text-left">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {topDiagnosis.map((diag, idx) => (
                    <tr
                      key={idx}
                      className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-2 px-3">{diag.diagnosis}</td>
                      <td className="py-2 px-3">{diag.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ====== MONTHLY TREND + MONTHLY REVENUE (2 columns) ====== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* MONTHLY TREND (TOGGLE LINE CHART) */}
          <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Monthly Trend</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => setSelectedTrend("gender")}
                  className={`px-3 py-1 text-sm font-medium rounded-md 
                    ${selectedTrend === "gender" ? "bg-primary text-white" : "bg-gray-200"}`}
                >
                  Patient Ratio
                </button>
                <button
                  onClick={() => setSelectedTrend("age")}
                  className={`px-3 py-1 text-sm font-medium rounded-md 
                    ${selectedTrend === "age" ? "bg-primary text-white" : "bg-gray-200"}`}
                >
                  Age Group
                </button>
              </div>
            </div>
            <div className="w-full h-64">
              <ResponsiveContainer>
                <LineChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {linesToRender.map((cfg, idx) => (
                    <Line
                      key={idx}
                      type="monotone"
                      dataKey={cfg.dataKey}
                      stroke={cfg.stroke}
                      name={cfg.name}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* MONTHLY REVENUE CHART */}
          <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm">
            <h3 className="font-semibold mb-2">Monthly Revenue</h3>
            <div className="w-full h-72">
              <ResponsiveContainer>
                <BarChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="revenue" fill="#82ca9d" name="Revenue (₹)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ====== PAYMENT MODE, TOP DEPARTMENTS, MONTHLY FOOTFALL (3 columns) ====== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* PAYMENT MODE PIE */}
          <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Payment Mode</h3>
            </div>
            <div className="w-full h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={payModePieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {payModePieData.map((entry, idx) => (
                      <Cell
                        key={`pmcell-${idx}`}
                        fill={payModeColors[idx % payModeColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* TOP DEPARTMENTS BAR */}
          <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Top Depts</h3>
            </div>
            <div className="w-full h-72">
              <ResponsiveContainer>
                <BarChart data={deptBarData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="department" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#8884d8" name="Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* MONTHLY FOOTFALL */}
          <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm">
            <h3 className="font-semibold mb-2">Monthly Footfall</h3>
            <div className="w-full h-72">
              <ResponsiveContainer>
                <LineChart data={footfallLineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#FF7F50" name="Visits" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ====== REPEAT VISITS, TOP DOCTORS, TOP SERVICES (3 columns) ====== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* REPEAT VISITS */}
          <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm">
            <h3 className="font-semibold mb-2">Repeat Visits</h3>
            <div className="text-sm space-y-2 mt-2">
              <p>1 Visit: {repeatVisits.one || 0}</p>
              <p>2 Visits: {repeatVisits.two || 0}</p>
              <p>3 Visits: {repeatVisits.three || 0}</p>
              <p>4+ Visits: {repeatVisits.four_plus || 0}</p>
            </div>
          </div>

          {/* TOP DOCTORS */}
          <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Briefcase className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Top Doctors</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-2 px-3 text-left">Doctor</th>
                    <th className="py-2 px-3 text-left">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {topDoctors.map((doc, i) => (
                    <tr
                      key={i}
                      className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-2 px-3">{doc.doctor}</td>
                      <td className="py-2 px-3">{doc.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* TOP SERVICES */}
          <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Briefcase className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Top Services</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-2 px-3 text-left">Service</th>
                    <th className="py-2 px-3 text-left">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {topServices.map((srv, i) => (
                    <tr
                      key={i}
                      className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-2 px-3">{srv.service}</td>
                      <td className="py-2 px-3">{srv.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {/* End of rows */}
      </div>
    </div>
  );
}

/** A simple loading screen placeholder. */
function LoadingScreen() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
      <p className="text-gray-500">Loading Report...</p>
    </div>
  );
}

/** A simple error screen placeholder. */
function ErrorScreen({ message }) {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
      <div className="bg-red-100 text-red-600 p-4 rounded shadow-sm">
        {message}
      </div>
    </div>
  );
}

/** A reusable KPI card component. */
function KpiCard({ icon, label, value }) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-4 flex flex-col justify-center shadow-sm">
      <div className="flex items-center space-x-2 mb-2">
        <div className="w-8 h-8 bg-primary/10 flex items-center justify-center rounded-md">
          {icon}
        </div>
        <p className="text-sm text-gray-600">{label}</p>
      </div>
      <h2 className="text-xl font-semibold text-gray-800">{value}</h2>
    </div>
  );
}
