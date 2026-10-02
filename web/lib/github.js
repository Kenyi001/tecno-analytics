const REPO = "Kenyi001/tecno-analytics";

const WORKFLOWS = {
  ventas: "ventas.yml",
  cobertura: "cobertura.yml",
};

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

async function disparar(workflow) {
  const headers = encabezados();
  if (!headers) {
    const error = new Error("sin-permiso");
    error.codigo = 503;
    throw error;
  }
  const respuesta = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`,
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

export async function dispararVentas() {
  return disparar(WORKFLOWS.ventas);
}

export async function dispararCobertura() {
  return disparar(WORKFLOWS.cobertura);
}

function fraseDelPaso(trabajo, nombre, segundos) {
  const texto = String(nombre || "").toLowerCase();
  if (trabajo === "cobertura") {
    if (texto.includes("bajar") || texto.includes("pegar") || texto.includes("subir")) {
      if (segundos > 360) return "Ya casi termina. Subiendo el Excel y los números.";
      if (segundos > 240) return "Pegando el stock en Datos y calculando cobertura.";
      if (segundos > 90) return "Bajando el stock de DCR. Puede tardar unos minutos.";
      if (segundos > 20) return "Entrando a DCR.";
      return "Empezando la actualización de cobertura.";
    }
    if (texto.includes("chrome") || texto.includes("instalar")) return "Preparando la actualización.";
    return "Preparando la actualización.";
  }
  if (texto.includes("entrar") || texto.includes("ventas")) {
    if (segundos > 40) return "Ya casi termina. Guardando el archivo del día.";
    if (segundos > 18) return "Pidiendo la tabla de ventas en DCR.";
    return "Entrando a DCR.";
  }
  if (texto.includes("chrome") || texto.includes("instalar")) return "Preparando la actualización.";
  return "Preparando la actualización.";
}

async function estadoDeWorkflow(workflow, trabajo, desdeMs, avisoFallo) {
  const headers = encabezados();
  if (!headers) return { estado: "fallo", aviso: "Falta el permiso para actualizar." };
  const respuesta = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/runs?per_page=5`,
    { headers, cache: "no-store" }
  );
  if (!respuesta.ok) return { estado: "actualizando", avance: 12, frase: "Buscando la actualización." };
  const data = await respuesta.json();
  const corridas = data.workflow_runs || [];
  const corrida = corridas.find((item) => Date.parse(item.created_at) >= desdeMs - 15000);
  if (!corrida) return { estado: "actualizando", avance: 8, frase: "En fila para empezar." };
  if (corrida.status === "completed") {
    if (corrida.conclusion === "success") return { estado: "termino", avance: 100, frase: "Listo." };
    return { estado: "fallo", aviso: avisoFallo };
  }
  const segundos = Math.max(0, (Date.now() - Date.parse(corrida.created_at)) / 1000);
  let frase = corrida.status === "queued" ? "En fila para empezar." : "Preparando la actualización.";
  let avance = corrida.status === "queued" ? 10 : Math.min(36, 16 + segundos * 0.15);
  const trabajos = await fetch(`https://api.github.com/repos/${REPO}/actions/runs/${corrida.id}/jobs`, {
    headers,
    cache: "no-store",
  });
  if (trabajos.ok) {
    const cuerpo = await trabajos.json();
    const pasos = (cuerpo.jobs || []).flatMap((job) => job.steps || []);
    const activo =
      [...pasos].reverse().find((paso) => paso.status === "in_progress") ||
      pasos.find((paso) => paso.status !== "completed");
    const hechos = pasos.filter((paso) => paso.status === "completed").length;
    if (pasos.length) avance = Math.min(92, Math.round((hechos / pasos.length) * 100));
    if (activo) {
      frase = fraseDelPaso(trabajo, activo.name, segundos);
      if (trabajo === "cobertura" && segundos > 300) avance = Math.max(avance, 78);
      if (trabajo === "ventas" && segundos > 40) avance = Math.max(avance, 88);
    }
  }
  return { estado: "actualizando", avance, frase };
}

export async function estadoTrabajo(desdeMs) {
  return estadoDeWorkflow(WORKFLOWS.ventas, "ventas", desdeMs, "La actualización de ventas no terminó.");
}

export async function estadoCobertura(desdeMs) {
  return estadoDeWorkflow(
    WORKFLOWS.cobertura,
    "cobertura",
    desdeMs,
    "La actualización de cobertura no terminó."
  );
}
