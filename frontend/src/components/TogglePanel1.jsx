// TogglePanel1.jsx

import React from 'react';

const TogglePanel = ({ isActive, toggleForm }) => (
    <div className="toggle-container">
        <div className={`toggle ${isActive ? 'active' : ''}`}>
            <div className="toggle-panel toggle-left">
                <h1>Hello, Doctor!</h1>
                <p>Register with your personal details to use all site features</p>
                <button onClick={toggleForm}>Sign Up</button>
            </div>
            <div className="toggle-panel toggle-right">
                <h1>Welcome Back!</h1>
                <p>Enter your personal details to use all site features</p>
                <button onClick={toggleForm}>Sign In</button>
            </div>
        </div>
    </div>
);

export default TogglePanel;
