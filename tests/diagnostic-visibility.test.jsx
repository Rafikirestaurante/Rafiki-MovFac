import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import SettingsPage from "../src/pages/SettingsPage.jsx";
import MovementsPage from "../src/pages/MovementsPage.jsx";

describe("Acceso al diagnóstico", () => {
  for (const role of ["platform_admin", "workspace_owner", "reviewer"]) {
    it(`Configuración muestra el panel abierto para ${role}`, () => {
      const html = renderToStaticMarkup(<SettingsPage profile={{role}} />);
      expect(html).toContain('class="panel-card sync-diagnostic" open=""');
      expect(html).toContain("Diagnóstico avanzado de sincronización");
      expect(html).toContain("Actualizar diagnóstico");
      expect(html).toContain("1.9.0");
      expect(html.indexOf("Diagnóstico avanzado de sincronización")).toBeGreaterThan(html.indexOf("Sincronización Gmail"));
    });
  }
  it("Movimientos no muestra diagnóstico ni recuadro redundante", () => {
    const html = renderToStaticMarkup(<MovementsPage profile={{role:"workspace_owner"}} />);
    expect(html).not.toContain("Diagnóstico avanzado de sincronización");
    expect(html).not.toContain("latest-movement-card");
  });
});
