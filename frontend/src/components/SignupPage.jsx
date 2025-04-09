import React, { useState } from 'react';
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import TogglePanel from './TogglePanel1';
import './Auth.css';

const SignUpPage = () => {
    const [isActive, setIsActive] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();
    const { signup, error, isLoading } = useAuthStore();

    const handleSignIn = () => {
        setIsActive(!isActive); 
        navigate('/login');
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        if (!email || !password || !name) {
            alert("Please fill in all fields");
            return;
        }
        try {
            await signup(email, password, name);
            navigate("/verify-email");
        } catch (error) {
            console.log(error);
        }
    };

    return (
        <div className={`container ${isActive ? 'active' : ''}`} id="container">
            <div className="form-container sign-in">
                <form onSubmit={handleSignUp}>
                    <h1>Create Account</h1><br />
                    <span>or use your email for registration</span>
                    <input
                        type='text'
                        placeholder='Full Name'
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <input
                        type='email'
                        placeholder='Email Address'
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <input
                        type='password'
                        placeholder='Password'
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
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
                        {isLoading ? "Signing Up..." : "Sign Up"}
                    </button>
                </form>
            </div>
            <TogglePanel isActive={isActive} toggleForm={handleSignIn} />
        </div>
    );
};

export default SignUpPage;
