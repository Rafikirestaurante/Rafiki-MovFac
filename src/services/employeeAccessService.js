export async function getEmployeeAccessSettings() { return { configured: false, enabled: false, username: "", password_configured: false, public_url: "" }; }
export async function saveEmployeeAccessSettings() { throw new Error("El acceso de empleados fue retirado de esta versión."); }
