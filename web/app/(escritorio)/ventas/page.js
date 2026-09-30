"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function Barras({ items }) {
  const tope = Math.max(...items.map((item) => item.ventas), 1);
  return (
    <ul className="barras">
      {items.map((item) => (
        <li key={item.nombre}>
          <span className="barra-nombre">{item.nombre}</span>
          <span className="barra-riel">
            <span style={{ width: `${Math.round((item.ventas / tope) * 100)}%` }} />
          </span>
          <span className="barra-num">{item.ventas}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Ventas() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [actualizando, setActualizando] = useState(false);
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
        if (cuerpoEstado.estado === "listo") {
          clearInterval(timer.current);
          await cargar();
          setActualizando(false);
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
  const modelos = (conteos?.porModelo || []).slice(0, 8);
  const ciudades = (conteos?.porCiudad || []).slice(0, 8);

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
          <button type="button" className="btn" onClick={actualizar} disabled={!datos || actualizando}>
            {actualizando ? `Actualizando ventas hasta ${hasta}` : `Actualizar hasta ${hasta}`}
          </button>
          {datos?.vista?.actualizadoTexto ? (
            <p className="sub">
              Última actualización {datos.vista.actualizadoTexto}. Datos del Excel hasta {datos.vista.datosTexto}.
            </p>
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
      {conteos ? (
        <>
          <div className="numeros">
            <article>
              <span>Registros</span>
              <strong>{conteos.registros}</strong>
            </article>
            <article>
              <span>Ciudades</span>
              <strong>{conteos.porCiudad?.length || 0}</strong>
            </article>
            <article>
              <span>Estados</span>
              <strong>{conteos.porEstado?.length || 0}</strong>
            </article>
          </div>
          <div className="dos-conteos">
            <article className="panel">
              <h2>Por modelo</h2>
              {modelos.length ? <Barras items={modelos} /> : <p className="sub">Sin registros.</p>}
            </article>
            <article className="panel">
              <h2>Por ciudad</h2>
              {ciudades.length ? <Barras items={ciudades} /> : <p className="sub">Sin registros.</p>}
            </article>
          </div>
        </>
      ) : null}
      {datos ? (
        <article className="panel lista-archivos">
          <h2>Archivos del ciclo</h2>
          {datos.archivos.length ? (
            <table className="lista">
              <thead>
                <tr>
                  <th>Día</th>
                  <th>Actualizado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {datos.archivos.map((archivo) => (
                  <tr key={archivo.dia}>
                    <td>{archivo.texto}</td>
                    <td>{archivo.subidoTexto}</td>
                    <td className="derecha">
                      <Link href={`/ventas/libro?dia=${archivo.dia}`}>Abrir</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="sub">Todavía no hay un archivo de este ciclo.</p>
          )}
        </article>
      ) : null}
    </section>
  );
}
