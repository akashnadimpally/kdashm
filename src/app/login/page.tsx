"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Terminal, Shield, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Refresh page state and redirect to dashboard home
      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        width: "100vw",
        background: "radial-gradient(circle at center, #1e1e24 0%, #0a0a0c 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Dynamic Background Accents */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "15%",
          width: "350px",
          height: "350px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          right: "15%",
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)",
          filter: "blur(50px)",
          pointerEvents: "none",
        }}
      />

      {/* Login Box */}
      <div
        className="glass"
        style={{
          width: "100%",
          maxWidth: "440px",
          borderRadius: "24px",
          padding: "3rem 2.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "2rem",
          zIndex: 10,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "rgba(59, 130, 246, 0.1)",
              border: "1px solid rgba(59, 130, 246, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 20px rgba(59, 130, 246, 0.15)",
            }}
          >
            <Shield style={{ width: "28px", height: "28px", color: "#3b82f6" }} />
          </div>
          <h1
            className="gradient-text"
            style={{
              fontSize: "2rem",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              textAlign: "center",
            }}
          >
            kDashM Dashboard
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "0.875rem", textAlign: "center" }}>
            Enter your credentials to manage Kubernetes clusters
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              color: "#f87171",
              padding: "0.875rem 1rem",
              borderRadius: "12px",
              fontSize: "0.875rem",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#94a3b8" }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@kdashm.local"
              required
              disabled={loading}
              style={{
                width: "100%",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid var(--glass-border)",
                borderRadius: "12px",
                padding: "0.875rem 1rem",
                color: "var(--foreground)",
                fontSize: "0.95rem",
                outline: "none",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--primary)";
                e.target.style.boxShadow = "0 0 10px rgba(59, 130, 246, 0.15)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--glass-border)";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#94a3b8" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                style={{
                  width: "100%",
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: "12px",
                  padding: "0.875rem 3rem 0.875rem 1rem",
                  color: "var(--foreground)",
                  fontSize: "0.95rem",
                  outline: "none",
                  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--primary)";
                  e.target.style.boxShadow = "0 0 10px rgba(59, 130, 246, 0.15)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--glass-border)";
                  e.target.style.boxShadow = "none";
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "4px",
                }}
              >
                {showPassword ? (
                  <EyeOff style={{ width: "18px", height: "18px" }} />
                ) : (
                  <Eye style={{ width: "18px", height: "18px" }} />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              background: "linear-gradient(135deg, var(--primary), var(--secondary))",
              border: "none",
              borderRadius: "12px",
              padding: "1rem",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: "0.95rem",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "transform 0.1s ease, opacity 0.2s ease",
              marginTop: "0.75rem",
              boxShadow: "0 4px 20px rgba(59, 130, 246, 0.25)",
              opacity: loading ? 0.7 : 1,
            }}
            onMouseDown={(e) => {
              if (!loading) e.currentTarget.style.transform = "scale(0.98)";
            }}
            onMouseUp={(e) => {
              if (!loading) e.currentTarget.style.transform = "scale(1)";
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>

      {/* Footer Info */}
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          color: "#475569",
          fontSize: "0.75rem",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontFamily: "var(--font-geist-mono), monospace",
        }}
      >
        <Terminal style={{ width: "12px", height: "12px" }} />
        <span>kDashM POC Authorization v1.0.0</span>
      </div>
    </div>
  );
}
