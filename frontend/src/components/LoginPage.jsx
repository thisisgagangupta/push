import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import TogglePanel from './TogglePanel';
import './Auth.css';

const LoginPage = () => {
    const [isActive, setIsActive] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();
    const { login, isLoading, error } = useAuthStore();

    const handleSignUp = () => {
        setIsActive(!isActive);  // Toggle to Sign Up form
        navigate('/signup');
    };

    // const handleLogin = async (e) => {
    //     e.preventDefault();
    //     if (!email || !password) {
    //         alert("Please fill in all fields");
    //         return;
    //     }
    //     await login(email, password);
    //     navigate("/");
    // };

    const handleLogin = async (e) => {
        e.preventDefault();
    
        if (!email || !password) {
          alert("Please fill in all fields");
          return;
        }
    
        try {
          await login(email, password);
          // If login is successful, navigate to the home page
          navigate("/home");
        } catch (err) {
          console.error("Login failed:", err);
        }
      };


    return (
        <div className={`container ${isActive ? 'active' : ''}`} id="container">
            <div className="form-container sign-in">
                <form onSubmit={handleLogin}>
                    <h1>Sign In</h1><br />
                    <span>or use your email and password</span>
                    <input
                        type="email"
                        placeholder="Email Address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <Link to="/forgot-password">Forgot Password?</Link>
                    {error && (
                    <p 
                        style={{
                        color: '#f56565', 
                        fontWeight: '600', 
                        marginBottom: '8px',
                        }}
                    >
                        {error}
                    </p>
                    )}
                    <button type="submit" disabled={isLoading}>
                        {isLoading ? "Signing In..." : "Sign In"}
                    </button>
                </form>
            </div>
            <TogglePanel isActive={isActive} toggleForm={handleSignUp} />
        </div>
    );
};

export default LoginPage;
