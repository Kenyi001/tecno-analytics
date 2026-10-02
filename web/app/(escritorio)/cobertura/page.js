"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

const COLOR_CLAVE = "#003366";
const COLOR_MIX = "#8ecae6";
const COLOR_TECNO = "#009bde";

const CORTES = [
  { id: "lk7", nombre: "LK7", detalle: "Cualquier LK7, Lambo incluido.", color: COLOR_CLAVE },
  { id: "lambo", nombre: "LK7 Lamborghini Black", detalle: "Solo el color Lambo.", color: COLOR_MIX },
  { id: "lk7k", nombre: "LK7K", detalle: "Solo LK7K.", color: COLOR_TECNO },
];

function tarjeta(grupo) {
  if (!grupo) return null;
  return grupo;
}

function numero(valor) {
  return new Intl.NumberFormat("es-BO").format(valor ?? 0);
}

async function esExcel(archivo) {
  const firma = new Uint8Array(await archivo.slice(0, 2).arrayBuffer());
  return firma[0] === 0x50 && firma[1] === 0x4b;
}

export default function Cobertura() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const archivoRef = useRef(null);

  function cargar() {
    return fetch("/api/cobertura", { cache: "no-store" })
      .then(async (respuesta) => {
        if (!respuesta.ok) throw new Error("lectura");
        setDatos(await respuesta.json());
        setError("");
      })
      .catch(() => setError("No se pudo leer la cobertura."));
  }

  useEffect(() => {
    cargar();
  }, []);

  async function subirExcel(evento) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;
    if (!archivo.name.toLowerCase().endsWith(".xlsx") || !(await esExcel(archivo))) {
      setAviso("El archivo tiene que ser un Excel .xlsx.");
      return;
    }
    setSubiendo(true);
    setAviso("");
    try {
      await upload("cobertura/actual.xlsx", archivo, {
        access: "private",
        handleUploadUrl: "/api/cobertura/subir",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        multipart: archivo.size > 4 * 1024 * 1024,
      });
      await cargar();
      setAviso("Excel subido. La fecha de actualización ya es la de esta subida.");
    } catch {
      setAviso("No se pudo subir el Excel.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <section>
      <div className="encabezado">
        <div>
          <h1>Cobertura</h1>
          <p className="ciclo">
            {datos?.referenciaTexto && datos?.cierreTexto
              ? `Tiendas con stock al ${datos.referenciaTexto}. Pronóstico al ${datos.cierreTexto}.`
              : "Tiendas del circuito con al menos un teléfono clave."}
          </p>
        </div>
        <div className="actualizar">
          {datos?.actualizadoTexto ? (
            <p className="sub">
              Última actualización {datos.actualizadoTexto}. Datos del Excel hasta {datos.referenciaTexto}.
            </p>
          ) : null}
        </div>
      </div>
      {aviso ? <p className="aviso">{aviso}</p> : null}
      {error ? <p className="aviso fallo">{error}</p> : null}
      {!datos && !error ? <p className="aviso">Cargando cobertura…</p> : null}
      {datos ? (
        <article className="panel lista-archivos">
          <h2>
            {datos.referenciaTexto && datos.cierreTexto
              ? `Reporte del ${datos.referenciaTexto} – ${datos.cierreTexto}`
              : "Reporte de cobertura"}
          </h2>
          <div className="reporte-actual">
            <div>
              <p className="sub">Total {datos.filasDatos} registros.</p>
              <p className="sub">
                Abre el libro de este reporte
                {datos.referenciaTexto && datos.cierreTexto
                  ? `, del ${datos.referenciaTexto} al ${datos.cierreTexto},`
                  : ""}{" "}
                en el navegador.
              </p>
              <p className="sub">
                {datos.tiendas} tiendas · Top 300: {datos.top300}. Para cambiar el libro, edítalo en Excel, ciérralo y súbelo. La fecha de arriba pasa a ser la de esa subida.
              </p>
            </div>
            <div className="reporte-acciones">
              <label className={`btn secundario${subiendo ? " ocupado" : ""}`}>
                {subiendo ? "Subiendo…" : "Subir Excel"}
                <input
                  ref={archivoRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  hidden
                  disabled={subiendo}
                  onChange={subirExcel}
                />
              </label>
              <Link className="btn" href="/cobertura/libro">
                Abrir el Excel
              </Link>
            </div>
          </div>
        </article>
      ) : null}
      {datos ? (
        <>
          <p className="sub explicacion">
            Porcentaje de tiendas con al menos 1 unidad. Stock = unidades en tienda.
          </p>
          <div className="tres-conteos">
            {CORTES.map((corte) => {
              const todas = tarjeta(datos.grupos?.[corte.id]?.todas);
              if (!todas) return null;
              const avance = Math.min(100, Math.max(0, todas.pct || 0));
              return (
                <article key={corte.id} className="panel cobertura-tarjeta">
                  <h2>{corte.nombre}</h2>
                  <p className="sub explicacion">{corte.detalle}</p>
                  <div className="cobertura-pista" aria-hidden="true">
                    <span style={{ width: `${avance}%`, background: corte.color }} />
                  </div>
                  <div className="numeros">
                    <article>
                      <span>Tiendas con stock</span>
                      <strong style={{ color: corte.color }}>{todas.pct}%</strong>
                      <p className="sub">
                        {numero(todas.cubiertas)} de {numero(todas.total)} tiendas
                      </p>
                    </article>
                    <article>
                      <span>Stock</span>
                      <strong>{numero(todas.cantidad)}</strong>
                      <p className="sub">unidades en tienda</p>
                    </article>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}
