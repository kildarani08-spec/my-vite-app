import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { fetchPublicSiteContent, getDefaultSiteContent } from "../utils/siteContent";

function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialPrefill = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      email: params.get("email") || "",
      coupon: params.get("coupon") || ""
    };
  }, [location.search]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(() => initialPrefill.email);
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [message, setMessage] = useState("");
  const [siteContent, setSiteContent] = useState(() => getDefaultSiteContent());

  const coupon = initialPrefill.coupon;
  const registerCopy = siteContent.authPages?.register || {};

  useEffect(() => {
    const controller = new AbortController();
    fetchPublicSiteContent(controller.signal)
      .then((content) => {
        setSiteContent(content);
      })
      .catch(() => {});

    return () => controller.abort();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ✅ Password validation
    const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[A-Za-z0-9!@#$%^&*]{8,}$/;
    if (!passwordRegex.test(password)) {
      setMessage(registerCopy.validationPasswordText || "Password must be at least 8 characters long and include a number and a symbol.");
      return;
    }

    // ✅ Phone validation
    const phoneRegex = /^[0-9]{10,15}$/;
    if (phoneNumber && !phoneRegex.test(phoneNumber)) {
      setMessage(registerCopy.validationPhoneText || "Phone number must be 10-15 digits.");
      return;
    }

    // ✅ DOB validation
    if (!dateOfBirth) {
      setMessage(registerCopy.validationDobRequiredText || "Date of birth is required.");
      return;
    }
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    if (dob >= today) {
      setMessage(registerCopy.validationDobPastText || "Date of birth must be in the past.");
      return;
    }
    if (age < 18) {
      setMessage(registerCopy.validationAgeText || "You must be at least 18 years old to register.");
      return;
    }

    try {
      const response = await fetch("https://my-vite-app-backend.onrender.com/register.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          password,
          phone_number: phoneNumber,
          date_of_birth: dateOfBirth
        }),
      });

      const data = await response.json();
      if (response.ok) {
        navigate("/login", { state: { success: registerCopy.successRedirectMessage || "Registration successful! Please log in." } });
      } else {
        setMessage(data.error || registerCopy.registrationFailedText || "Registration failed");
      }
    } catch {
      setMessage(registerCopy.networkErrorText || "Network error");
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <h2 className="login-title">{registerCopy.title || "Create Account"}</h2>
        {coupon && <p className="success-text">{registerCopy.rewardPrefix || "Welcome reward unlocked:"} {coupon}</p>}

        <input type="text" placeholder={registerCopy.firstNamePlaceholder || "First Name"} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        <input type="text" placeholder={registerCopy.lastNamePlaceholder || "Last Name"} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        <input type="email" placeholder={registerCopy.emailPlaceholder || "Email"} value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder={registerCopy.passwordPlaceholder || "Password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <input type="text" placeholder={registerCopy.phonePlaceholder || "Phone Number"} value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
        <input type="date" placeholder={registerCopy.dobPlaceholder || "Date of Birth"} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />

        <button type="submit" className="login-btn">{registerCopy.submitLabel || "Register"}</button>
        {message && <p className="error-text">{message}</p>}

        <div className="login-footer">
          {registerCopy.alreadyRegisteredPrefix || "Already registered?"} <Link to="/login">{registerCopy.loginHereLabel || "Login here"}</Link>
        </div>
      </form>
    </div>
  );
}

export default Register;
