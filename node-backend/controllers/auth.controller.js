import bcryptjs from "bcryptjs";
import crypto from "crypto";

import { generateTokenAndSetCookie } from "../utils/generateTokenAndSetCookie.js";
import {
 	sendPasswordResetEmail,
 	sendResetSuccessEmail,
 	sendVerificationEmail,
// 	sendWelcomeEmail,
 } from "../mailtrap/emails.js";
//import { User } from "../models/user.model.js";
import pool from "../db/db.js"

export const signup = async (req, res) => {
	const { email, password, name } = req.body;
  
	try {
	  if (!email || !password || !name) {
		throw new Error("All fields are required");
	  }
  
	  // 1) Check if user already exists
	  const { rows: existing } = await pool.query(
		`SELECT * FROM users WHERE email = $1`,
		[email]
	  );
	  if (existing.length > 0) {
		return res
		  .status(400)
		  .json({ success: false, message: "User already exists" });
	  }
  
	  // 2) Hash password
	  const hashedPassword = await bcryptjs.hash(password, 10);
	  const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
	  const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
	  // 3) Insert user into Postgres
	  const insertQuery = `
		INSERT INTO users (
		  email, password, name, 
		  "verificationToken", "verificationTokenExpiresAt",
		  "isVerified"
		) 
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING *;
	  `;
	  const insertValues = [
		email,
		hashedPassword,
		name,
		verificationToken,
		verificationTokenExpiresAt,
		false,
	  ];
  
	  const { rows } = await pool.query(insertQuery, insertValues);
	  const user = rows[0];
  
	  // 4) JWT Token & Cookie
	  generateTokenAndSetCookie(res, user.id);
	  await sendVerificationEmail(user.email, verificationToken);
  
	  // 5) Send response
	  res.status(201).json({
		success: true,
		message: "User created successfully",
		user: {
		  id: user.id,
		  email: user.email,
		  name: user.name,
		  verificationToken: user.verificationToken,
		  // omit password, etc.
		},
	  });
	} catch (error) {
	  res.status(400).json({ success: false, message: error.message });
	}
  };
  

  export const verifyEmail = async (req, res) => {
	const { code } = req.body;  // 'code' is the token from the client
	try {
	  // 1) Find the user with matching verificationToken and unexpired verificationTokenExpiresAt
	  const now = new Date();
	  const selectQuery = `
		SELECT * 
		FROM users
		WHERE "verificationToken" = $1
		AND "verificationTokenExpiresAt" > $2
		LIMIT 1
	  `;
	  const { rows } = await pool.query(selectQuery, [code, now]);
	  const user = rows[0];
  
	  if (!user) {
		return res
		  .status(400)
		  .json({ success: false, message: "Invalid or expired verification code" });
	  }
  
	  // 2) Mark user as verified by updating the relevant columns
	  const updateQuery = `
		UPDATE users
		SET "isVerified" = $1,
			"verificationToken" = $2,
			"verificationTokenExpiresAt" = $3
		WHERE id = $4
	  `;
	  await pool.query(updateQuery, [true, null, null, user.id]);
  
	  // 3) Send welcome email (if desired)
	  //await sendWelcomeEmail(user.email, user.name);
  
	  // 4) Return response
	  //    We can reuse the user data, just patch the changed fields
	  const updatedUser = {
		...user,
		isVerified: true,
		verificationToken: null,
		verificationTokenExpiresAt: null,
		password: undefined, // or omit it if you had it in the row
	  };
  
	  res.status(200).json({
		success: true,
		message: "Email verified successfully",
		user: updatedUser,
	  });
	} catch (error) {
	  console.log("error in verifyEmail ", error);
	  res.status(500).json({ success: false, message: "Server error" });
	}
  };
export const login = async (req, res) => {
	const { email, password } = req.body;
  
	try {
	  // 1) Find user by email
	  const { rows } = await pool.query(
		`SELECT * FROM users WHERE email = $1`,
		[email]
	  );
	  const user = rows[0];
  
	  if (!user) {
		return res.status(400).json({
		  success: false,
		  message: "Invalid credentials (user not found)",
		});
	  }
  
	  // 2) Compare password
	  const isPasswordValid = await bcryptjs.compare(password, user.password);
	  if (!isPasswordValid) {
		return res
		  .status(400)
		  .json({ success: false, message: "Invalid credentials" });
	  }
  
	  // 3) Generate token
	  generateTokenAndSetCookie(res, user.id);
  
	  // 4) Update lastLogin
	  const now = new Date();
	  await pool.query(`UPDATE users SET "lastLogin" = $1 WHERE id = $2`, [
		now,
		user.id,
	  ]);
  
	  // 5) Return user
	  res.status(200).json({
		success: true,
		message: "Logged in successfully",
		user: {
		  id: user.id,
		  email: user.email,
		  name: user.name,
		  // omit password
		},
	  });
	} catch (error) {
	  res.status(400).json({ success: false, message: error.message });
	}
  };
  

// export const logout = async (req, res) => {
// 	res.clearCookie("token");
// 	res.status(200).json({ success: true, message: "Logged out successfully" });
// };

export const forgotPassword = async (req, res) => {
	const { email } = req.body;
  
	try {
	  // 1) Find user by email
	  const selectQuery = `
		SELECT * 
		FROM users
		WHERE email = $1
		LIMIT 1
	  `;
	  const { rows } = await pool.query(selectQuery, [email]);
	  const user = rows[0];
  
	  if (!user) {
		return res
		  .status(400)
		  .json({ success: false, message: "User not found" });
	  }
  
	  // 2) Generate reset token
	  const resetToken = crypto.randomBytes(20).toString("hex");
	  // Expires in 1 hour
	  const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
  
	  // 3) Update user columns in Postgres
	  const updateQuery = `
		UPDATE users
		SET "resetPasswordToken" = $1,
			"resetPasswordExpiresAt" = $2
		WHERE id = $3
	  `;
	  await pool.query(updateQuery, [resetToken, resetTokenExpiresAt, user.id]);
  
	  // 4) Send password reset email
	  //    e.g., https://yoursite.com/reset-password/<token>
	  const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
	  await sendPasswordResetEmail(user.email, resetLink);
  
	  // 5) Respond to client
	  res.status(200).json({
		success: true,
		message: "Password reset link sent to your email",
	  });
	} catch (error) {
	  console.log("Error in forgotPassword ", error);
	  res.status(400).json({
		success: false,
		message: error.message,
	  });
	}
  };

  export const resetPassword = async (req, res) => {
	try {
	  const { token } = req.params;   // e.g., /reset-password/:token
	  const { password } = req.body;  // New password from the request body
  
	  // 1) Find user by reset token and ensure it hasn't expired
	  const now = new Date();
	  const selectQuery = `
		SELECT * 
		FROM users
		WHERE "resetPasswordToken" = $1
		  AND "resetPasswordExpiresAt" > $2
		LIMIT 1
	  `;
	  const { rows } = await pool.query(selectQuery, [token, now]);
	  const user = rows[0];
  
	  if (!user) {
		return res
		  .status(400)
		  .json({ success: false, message: "Invalid or expired reset token" });
	  }
  
	  // 2) Hash the new password
	  const hashedPassword = await bcryptjs.hash(password, 10);
  
	  // 3) Update the user's password and clear out reset fields
	  const updateQuery = `
		UPDATE users
		SET password = $1,
			"resetPasswordToken" = NULL,
			"resetPasswordExpiresAt" = NULL
		WHERE id = $2
	  `;
	  await pool.query(updateQuery, [hashedPassword, user.id]);
  
	  // 4) Send a reset success email
	  await sendResetSuccessEmail(user.email);
  
	  // 5) Respond to the client
	  res.status(200).json({ success: true, message: "Password reset successful" });
	} catch (error) {
	  console.log("Error in resetPassword ", error);
	  res.status(400).json({ success: false, message: error.message });
	}
  };

  export const checkAuth = async (req, res) => {
	try {
	  // 1) We assume some middleware has already verified the JWT and set req.userId
	  const userId = req.userId;
	  if (!userId) {
		return res
		  .status(401)
		  .json({ success: false, message: "Not authenticated" });
	  }
  
	  // 2) Query your Postgres database for the user by ID
	  const { rows } = await pool.query(
		`SELECT id, email, name, "isVerified", "lastLogin" 
		 FROM users
		 WHERE id = $1
		 LIMIT 1;`,
		[userId]
	  );
  
	  const user = rows[0];
	  if (!user) {
		return res
		  .status(400)
		  .json({ success: false, message: "User not found" });
	  }
  
	  // 3) Return the user (minus any sensitive fields)
	  return res.status(200).json({
		success: true,
		user,
	  });
	} catch (error) {
	  console.error("Error in checkAuth:", error);
	  return res
		.status(400)
		.json({ success: false, message: error.message });
	}
  };
