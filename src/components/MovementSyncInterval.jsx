import React from "react";
import Icon from "./Icons.jsx";

export default function MovementSyncInterval({ seconds = 10, onChange }) {
  return (
    <details className="sync-interval-picker" onKeyDown={(event) => {
      if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary").focus(); }
    }} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
    }}>
      <summary aria-label="Configurar tiempo de sincronización de movimientos" title="Tiempo de sincronización"><Icon name="settings" size={13} /></summary>
      <div className="sync-interval-menu" role="group" aria-label="Tiempo de sincronización de movimientos">
        <span>Cada cuánto sincronizar</span>
        {[[10, "10 segundos"], [30, "30 segundos"], [60, "1 minuto"]].map(([value, label]) => (
          <button type="button" key={value} aria-pressed={seconds === value} onClick={(event) => {
            onChange(value);
            const picker = event.currentTarget.closest("details");
            picker.open = false;
            picker.querySelector("summary").focus();
          }}>{label}{seconds === value ? <Icon name="check" size={13} /> : null}</button>
        ))}
      </div>
    </details>
  );
}
