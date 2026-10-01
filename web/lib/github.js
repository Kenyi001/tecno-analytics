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

function fraseDelPaso(nombre, segundos) {
  const texto = String(nombre || "").toLowerCase();
  if (texto.includes("entrar") || texto.includes("ventas")) {
    if (segundos > 40) return "Ya casi termina. Guardando el archivo del día.";
    if (segundos > 18) return "Pidiendo la tabla de ventas en DCR.";
    return "Entrando a DCR.";
  }
  if (texto.includes("chrome") || texto.includes("instalar")) return "Preparando la actualización.";
  return "Preparando la actualización.";
}

export async function estadoTrabajo(desdeMs) {
  const headers = encabezados();
  if (!headers) return { estado: "fallo", aviso: "Falta el permiso para actualizar." };
  const respuesta = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=5`,
    { headers, cache: "no-store" }
  );
  if (!respuesta.ok) return { estado: "actualizando", avance: 12, frase: "Buscando la actualización." };
  const data = await respuesta.json();
  const corridas = data.workflow_runs || [];
  const corrida = corridas.find((item) => Date.parse(item.created_at) >= desdeMs - 15000);
  if (!corrida) return { estado: "actualizando", avance: 8, frase: "En fila para empezar." };
  if (corrida.status === "completed") {
    if (corrida.conclusion === "success") return { estado: "termino", avance: 100, frase: "Listo." };
    return { estado: "fallo", aviso: "La actualización de ventas no terminó." };
  }
  const segundos = Math.max(0, (Date.now() - Date.parse(corrida.created_at)) / 1000);
  let frase = corrida.status === "queued" ? "En fila para empezar." : "Preparando la actualización.";
  let avance = corrida.status === "queued" ? 10 : Math.min(36, 16 + segundos);
  const trabajos = await fetch(
    `https://api.github.com/repos/${REPO}/actions/runs/${corrida.id}/jobs`,
    { headers, cache: "no-store" }
  );
  if (trabajos.ok) {
    const cuerpo = await trabajos.json();
    const pasos = (cuerpo.jobs || []).flatMap((job) => job.steps || []);
    const activo = [...pasos].reverse().find((paso) => paso.status === "in_progress") || pasos.find((paso) => paso.status !== "completed");
    const hechos = pasos.filter((paso) => paso.status === "completed").length;
    if (pasos.length) avance = Math.min(92, Math.round((hechos / pasos.length) * 100));
    if (activo) {
      frase = fraseDelPaso(activo.name, segundos);
      if (segundos > 40) avance = Math.max(avance, 88);
    }
  }
  return { estado: "actualizando", avance, frase };
}
