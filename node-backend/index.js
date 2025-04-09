// import express from "express";
// import dotenv from "dotenv";
// import cors from "cors";
// import cookieParser from "cookie-parser";
// import path from "path";

// import authRoutes from "./routes/auth.route.js";

// dotenv.config();
// const app = express();
// const PORT = process.env.PORT || 3000;
// // const PORT = 3000;
// const __dirname = path.resolve();

// // app.use(cors({ origin: "http://localhost:5173", credentials: true }));
// app.use(cors({ origin: `${process.env.FRONTEND_URL}`, credentials: true }));
// app.use(express.json());
// app.use(cookieParser());

// // Routes
// app.use("/api/auth", authRoutes);

// if (process.env.NODE_ENV === "production") {
//   app.use(express.static(path.join(__dirname, "/frontend/dist")));
//   app.get("*", (req, res) => {
//     res.sendFile(path.resolve(__dirname, "frontend", "dist", "index.html"));
//   });
// }

// app.listen(PORT, () => {
//   console.log("Server is running on port: ", PORT);
// });










import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";

import authRoutes from "./routes/auth.route.js";
import { createProxyMiddleware } from "http-proxy-middleware";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
// const PORT = 3000;
const __dirname = path.resolve();

// app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use((req, res, next) => {
  // Allow any origin
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  
  // Allow all headers that might be sent
  const requestHeaders = req.headers['access-control-request-headers'];
  if (requestHeaders) {
    res.header('Access-Control-Allow-Headers', requestHeaders);
  } else {
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, *');
  }
  
  // Allow all methods
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  
  // Allow credentials always
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Allow browsers to expose all headers to client code
  res.header('Access-Control-Expose-Headers', '*');
  
  // Extend preflight cache time to reduce preflight requests
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});
// app.use(express.json());
app.use(cookieParser());

app.get("/health", (req, res) => {
  res.sendStatus(200);
});

// Routes
app.use("/api/auth", express.json(), authRoutes);

app.use(
  createProxyMiddleware({
    target: "http://localhost:5000", // or container name & port if Docker
    changeOrigin: true
  })
);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "/frontend/dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "frontend", "dist", "index.html"));
  });
}

app.listen(PORT, () => {
  console.log("Server is running on port: ", PORT);
});