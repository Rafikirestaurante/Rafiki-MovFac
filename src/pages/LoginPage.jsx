import React, { useState } from "react";
import Icon from "../components/Icons.jsx";
import { Alert } from "../components/Ui.jsx";
import { signIn, signUp } from "../services/authService.js";
import { supabaseConfigured } from "../supabaseClient.js";

export default function LoginPage() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("info");

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      if (mode === "register") {
        await signUp(form.email.trim(), form.password, form.name.trim());
        setTone("success");
        setMessage("Cuenta creada. Revisa tu correo si Supabase solicita confirmación antes de ingresar.");
        setMode("login");
      } else {
        await signIn(form.email.trim(), form.password);
      }
    } catch (error) {
      setTone("danger");
      setMessage(error.message || "No fue posible completar el acceso.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-showcase">
        <div className="showcase-content">
          <div className="showcase-brand"><span>R</span> Rafiki</div>
          <p className="showcase-kicker">CONTROL DOCUMENTAL</p>
          <h1>Movimientos bancarios y facturas, en un solo lugar.</h1>
          <p className="showcase-copy">Una aplicación independiente para consultar movimientos bancarios y organizar facturas detectadas desde Gmail.</p>
          <div className="showcase-points">
            <div><Icon name="mail" /><span>Lectura autorizada de Gmail</span></div>
            <div><Icon name="shield" /><span>Datos aislados de Rafiki Pedidos</span></div>
            <div><Icon name="check" /><span>Consulta rápida de movimientos</span></div>
          </div>
        </div>
        <div className="showcase-orb orb-one" />
        <div className="showcase-orb orb-two" />
      </section>

      <section className="login-form-panel">
        <div className="login-card">
          <div className="login-mobile-brand"><span>R</span><div><strong>Rafiki</strong><small>Movimientos y facturas</small></div></div>
          <span className="eyebrow">{mode === "login" ? "Bienvenido" : "Primer acceso"}</span>
          <h2>{mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</h2>
          <p>{mode === "login" ? "Ingresa con tu correo autorizado para consultar tu información documental." : "La cuenta inicial crea el Administrador. Las cuentas posteriores requieren autorización previa."}</p>

          {!supabaseConfigured ? <Alert tone="warning">Faltan las variables de Supabase. Copia <code>.env.example</code> a <code>.env</code> y completa los datos.</Alert> : null}
          {message ? <Alert tone={tone}>{message}</Alert> : null}

          <form onSubmit={submit} className="login-form">
            {mode === "register" ? (
              <label>
                Nombre
                <div className="input-with-icon"><Icon name="user" size={18} /><input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Nombre del usuario" required /></div>
              </label>
            ) : null}
            <label>
              Correo electrónico
              <div className="input-with-icon"><Icon name="mail" size={18} /><input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="correo@empresa.com" required /></div>
            </label>
            <label>
              Contraseña
              <div className="input-with-icon"><Icon name="shield" size={18} /><input type="password" minLength="8" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="Mínimo 8 caracteres" required /></div>
            </label>
            <button className="primary-button full" disabled={loading || !supabaseConfigured}>{loading ? "Procesando..." : mode === "login" ? "Ingresar" : "Crear cuenta"}</button>
          </form>

          <button className="text-button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setMessage(""); }}>
            {mode === "login" ? "¿Es la primera instalación? Crear cuenta inicial" : "Ya tengo cuenta. Volver al ingreso"}
          </button>
        </div>
      </section>
    </main>
  );
}
