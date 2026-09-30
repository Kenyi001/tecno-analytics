const REPO = "Kenyi001/tecno-analytics";
const WORKFLOW = "ventas.yml";

function encabezados() {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return null;
  return {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "tecno-analytics",
  };
}

export async function dispararVentas() {
  const headers = encabezados();
  if (!headers) {
    const error = new Error("sin-permiso");
    error.codigo = 503;
    throw error;
  }
  const respuesta = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ ref: "main" }),
    }
  );
  if (respuesta.status !== 204) {
    const error = new Error(`dispatch-${respuesta.status}`);
    error.codigo = respuesta.status === 401 || respuesta.status === 403 ? 503 : 502;
    throw error;
  }
}

export async function estadoTrabajo(desdeMs) {
  const headers = encabezados();
  if (!headers) return { estado: "fallo", aviso: "Falta el permiso para actualizar." };
  const respuesta = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=5`,
    { headers, cache: "no-store" }
  );
  if (!respuesta.ok) return { estado: "actualizando" };
  const data = await respuesta.json();
  const corridas = data.workflow_runs || [];
  const corrida = corridas.find((item) => Date.parse(item.created_at) >= desdeMs - 15000);
  if (!corrida) return { estado: "actualizando" };
  if (corrida.status !== "completed") return { estado: "actualizando" };
  if (corrida.conclusion === "success") return { estado: "termino" };
  return { estado: "fallo", aviso: "La actualización de ventas no terminó." };
}
