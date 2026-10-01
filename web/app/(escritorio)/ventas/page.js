"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function Barras({ items }) {
  const suma = items.reduce((total, item) => total + item.ventas, 0) || 1;
  return (
    <ul className="barras">
      {items.map((item) => {
        const parte = Math.round((item.ventas / suma) * 100);
        return (
          <li key={item.nombre}>
            <span className="barra-nombre">{item.nombre}</span>
            <span className="barra-riel">
              <span style={{ width: `${parte}%` }} />
            </span>
            <span className="barra-num">
              {item.ventas} · {parte}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function Ventas() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [actualizando, setActualizando] = useState(false);
  const [progreso, setProgreso] = useState({ avance: 8, frase: "En fila para empezar." });
  const timer = useRef(null);

  async function cargar() {
    const respuesta = await fetch("/api/ventas", { cache: "no-store" });
    if (!respuesta.ok) throw new Error("lectura");
    setDatos(await respuesta.json());
  }

  useEffect(() => {
    cargar().catch(() => setError("No se pudieron leer las ventas."));
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  async function actualizar() {
    if (!datos || actualizando) return;
    setAviso("");
    setProgreso({ avance: 8, frase: "En fila para empezar." });
    setActualizando(true);
    const respuesta = await fetch("/api/ventas", { method: "POST" });
    const cuerpo = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      setActualizando(false);
      setAviso(cuerpo.aviso || "No se pudo pedir la actualización.");
      return;
    }
    const desde = cuerpo.desde;
    const limite = Date.now() + 16 * 60 * 1000;
    timer.current = setInterval(async () => {
      if (Date.now() > limite) {
        clearInterval(timer.current);
        setActualizando(false);
        setAviso("La actualización sigue en curso. Vuelve a abrir Ventas en unos minutos.");
        return;
      }
      try {
        const estado = await fetch(`/api/ventas/estado?desde=${desde}`, { cache: "no-store" });
        const cuerpoEstado = await estado.json();
        if (cuerpoEstado.frase || cuerpoEstado.avance) {
          setProgreso({
            avance: cuerpoEstado.estado === "listo" ? 100 : cuerpoEstado.avance || 12,
            frase: cuerpoEstado.frase || "Trabajando en la actualización.",
          });
        }
        if (cuerpoEstado.estado === "listo") {
          clearInterval(timer.current);
          setProgreso({ avance: 100, frase: "Listo." });
          await cargar();
          setTimeout(() => setActualizando(false), 900);
        } else if (cuerpoEstado.estado === "fallo") {
          clearInterval(timer.current);
          setActualizando(false);
          setAviso(cuerpoEstado.aviso || "La actualización de ventas no terminó.");
        }
      } catch {
        // La siguiente vuelta vuelve a preguntar.
      }
    }, 8000);
  }

  const hasta = datos?.ciclo?.hastaTexto || "…";
  const conteos = datos?.vista?.conteos;
  const modelos = conteos?.porModelo || [];
  const departamentos = conteos?.porEstado || [];
  const areas = conteos?.porArea;
  const claves = conteos?.porClave || [];
  const sumaModelos = modelos.reduce((suma, item) => suma + item.ventas, 0);
  const rango =
    datos?.ciclo && datos?.vista ? `${datos.ciclo.inicioTexto} – ${datos.vista.datosTexto}` : "";

  return (
    <section>
      <div className="encabezado">
        <div>
          <h1>Ventas</h1>
          <p className="sub">
            {datos
              ? `Ciclo ${datos.ciclo.inicioTexto} – ${datos.ciclo.finTexto}.`
              : "Ventas del ciclo, del 21 al 20."}
          </p>
        </div>
        <div className="actualizar">
          {actualizando ? (
            <div className="progreso" role="status" aria-live="polite">
              <div className="progreso-pista">
                <div className="progreso-barra" style={{ width: `${Math.max(8, Math.min(100, progreso.avance))}%` }} />
              </div>
              <p className="sub">{progreso.frase}</p>
            </div>
          ) : (
            <button type="button" className="btn" onClick={actualizar} disabled={!datos}>
              {`Actualizar hasta ${hasta}`}
            </button>
          )}
          {datos?.vista?.actualizadoTexto ? (
            <>
              <p className="sub">
                Última actualización {datos.vista.actualizadoTexto}. Datos del Excel hasta {datos.vista.datosTexto}.
              </p>
              <p className="sub">
                Pide el Excel de Shop Sales Query New en DCR y lo guarda en el archivo del día.
              </p>
              <p className="sub">
                {datos.vista.calculadoTexto
                  ? `Reportes calculados ${datos.vista.calculadoTexto}.`
                  : "Los reportes muestran el cálculo guardado en el archivo."}
              </p>
            </>
          ) : datos ? (
            <p className="sub">Todavía no hay una actualización de este ciclo.</p>
          ) : null}
        </div>
      </div>
      {aviso ? <p className="aviso fallo">{aviso}</p> : null}
      {error ? <p className="aviso fallo">{error}</p> : null}
      {!datos && !error ? <p className="aviso">Cargando ventas…</p> : null}
      {datos && !conteos ? (
        <p className="aviso">Todavía no hay un archivo de este ciclo. Puedes pedirlo con el botón.</p>
      ) : null}
      {datos ? (
        <article className="panel lista-archivos">
          <h2>{rango ? `Reporte del ${rango}` : "Reporte del ciclo"}</h2>
          {datos.vista && conteos ? (
            <div className="reporte-actual">
              <p className="sub">Total {conteos.registros} registros.</p>
              <Link href={`/ventas/libro?dia=${datos.vista.dia}`}>Abrir</Link>
            </div>
          ) : (
            <p className="sub">Todavía no hay un archivo de este ciclo.</p>
          )}
        </article>
      ) : null}
      {conteos ? (
        <>
          <div className="numeros">
            <article>
              <span>Registros</span>
              <strong>{conteos.registros}</strong>
            </article>
            <article>
              <span>Departamentos</span>
              <strong>{conteos.porEstado?.length || 0}</strong>
            </article>
          </div>
          <div className="dos-conteos">
            <article className="panel">
              <h2>Modelos · {rango}</h2>
              <p className="sub explicacion">
                {modelos.length
                  ? `Están los ${modelos.length} modelos. Sumados dan ${sumaModelos} registros. El porcentaje es sobre ese total.`
                  : "Sin registros."}
              </p>
              {modelos.length ? <Barras items={modelos} /> : null}
            </article>
            <article className="panel">
              <h2>Departamentos · {rango}</h2>
              <p className="sub explicacion">
                El departamento de la venta en DCR: La Paz, Cochabamba, Santa Cruz y el resto. El Alto entra en La Paz, igual que en el Excel. El porcentaje es sobre el total del reporte.
              </p>
              {departamentos.length ? <Barras items={departamentos} /> : <p className="sub">Sin registros.</p>}
            </article>
          </div>
          <div className="dos-conteos">
            <article className="panel">
              <h2>Vendedores TECNO y mercado · {rango}</h2>
              <p className="sub explicacion">
                Position Area Sales Manager es TECNO. El resto de esa columna es el mercado.
              </p>
              {areas ? <Barras items={areas} /> : <p className="sub">Esa columna no está en el archivo.</p>}
            </article>
            <article className="panel">
              <h2>Modelos clave y MIX · {rango}</h2>
              <p className="sub explicacion">LK7 y LK7K son clave. El resto de los modelos es el MIX.</p>
              {claves.length ? <Barras items={claves} /> : <p className="sub">Sin registros.</p>}
            </article>
          </div>
        </>
      ) : null}
    </section>
  );
}
