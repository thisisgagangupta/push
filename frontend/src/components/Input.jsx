import React from "react";

const Input = ({ icon: Icon, ...props }) => {
  return (
    <div className="input-container">
      {Icon && <Icon className="input-icon" />}
      <input className="text-input" {...props} />
    </div>
  );
};

export default Input;
