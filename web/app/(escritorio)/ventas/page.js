"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function partesDe(items) {
  const suma = items.reduce((total, item) => total + item.ventas, 0);
  if (!suma) return items.map((item) => ({ ...item, parte: 0 }));
  const partes = items.map((item) => ({ ...item, parte: Math.round((item.ventas / suma) * 100) }));
  const ajuste = 100 - partes.reduce((total, item) => total + item.parte, 0);
  partes[partes.length - 1].parte += ajuste;
  return partes;
}

const COLOR_CLAVE = "#003366";
const COLOR_MIX = "#8ecae6";

function esClave(nombre) {
  return /^lk7k?$/i.test(String(nombre || "").trim());
}

function anchosDe(grupos, total) {
  if (!total) return grupos.map(() => 0);
  const anchos = grupos.map((grupo) => {
    const suma = grupo.partes.reduce((acumulado, parte) => acumulado + parte.ventas, 0);
    return Math.round((suma / total) * 100);
  });
  anchos[anchos.length - 1] += 100 - anchos.reduce((acumulado, ancho) => acumulado + ancho, 0);
  return anchos;
}

function Cruce({ titulo, nota, grupos, total }) {
  const anchos = anchosDe(grupos, total);
  return (
    <article className="panel bloque">
      <h2>{titulo}</h2>
      <p className="sub explicacion">{nota}</p>
      <ul className="cruce">
        {grupos.map((grupo, indice) => {
          const suma = grupo.partes.reduce((acumulado, parte) => acumulado + parte.ventas, 0);
          const partes = partesDe(grupo.partes);
          return (
            <li key={grupo.nombre}>
              <div className="cruce-cabeza">
                <strong>{grupo.nombre}</strong>
                <span>
                  Total {suma} · {anchos[indice]}% del reporte
                </span>
              </div>
              <div className="cruce-pista">
                <div className="cruce-barra" style={{ width: `${Math.max(0, anchos[indice])}%` }}>
                  {partes.map((parte) => (
                    <span
                      key={parte.nombre}
                      style={{
                        width: `${parte.parte}%`,
                        background: parte.nombre === "Clave" ? COLOR_CLAVE : COLOR_MIX,
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="cruce-detalle">
                {partes.map((parte) => (
                  <span key={parte.nombre}>
                    <i style={{ background: parte.nombre === "Clave" ? COLOR_CLAVE : COLOR_MIX }} />
                    {parte.nombre} {parte.ventas} · {parte.parte}% de {grupo.nombre}
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="corte-leyenda">
        <span>
          <i style={{ background: COLOR_CLAVE }} />
          Clave, LK7 y LK7K
        </span>
        <span>
          <i style={{ background: COLOR_MIX }} />
          MIX, los demás modelos
        </span>
        <strong className="corte-total">Total {total}</strong>
      </div>
    </article>
  );
}

function Barras({ items, colorDe, base, ancha }) {
  const suma = base || items.reduce((total, item) => total + item.ventas, 0) || 1;
  return (
    <ul className={ancha ? "barras anchas" : "barras"}>
      {items.map((item) => {
        const parte = Math.round((item.ventas / suma) * 100);
        return (
          <li key={item.nombre}>
            <span className="barra-nombre" title={item.nombre}>{item.nombre}</span>
            <span className="barra-riel">
              <span style={{ width: `${parte}%`, background: colorDe?.(item.nombre) }} />
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
  const [versiones, setVersiones] = useState(false);
  const [consultaAbierta, setConsultaAbierta] = useState(false);
  const [codigoBusqueda, setCodigoBusqueda] = useState("");
  const [consulta, setConsulta] = useState(null);
  const [buscandoCodigo, setBuscandoCodigo] = useState(false);
  const [errorCodigo, setErrorCodigo] = useState("");
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

  useEffect(() => {
    if (!consultaAbierta) return undefined;
    function alTeclado(evento) {
      if (evento.key === "Escape") setConsultaAbierta(false);
    }
    window.addEventListener("keydown", alTeclado);
    return () => window.removeEventListener("keydown", alTeclado);
  }, [consultaAbierta]);

  async function buscarCodigo(evento) {
    evento.preventDefault();
    const codigo = codigoBusqueda.trim();
    if (!codigo || buscandoCodigo) return;
    setBuscandoCodigo(true);
    setErrorCodigo("");
    setConsulta(null);
    try {
      const respuesta = await fetch(`/api/ventas/consulta?codigo=${encodeURIComponent(codigo)}`, { cache: "no-store" });
      const cuerpo = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) {
        setErrorCodigo(cuerpo.error || "No se pudo consultar ese código.");
        return;
      }
      setConsulta(cuerpo);
    } catch {
      setErrorCodigo("No se pudo consultar ese código.");
    } finally {
      setBuscandoCodigo(false);
    }
  }

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
  const cruce = conteos?.porCruce;
  const fijos = conteos?.porFijos || [];
  const pronostico = conteos?.pronostico;
  const sumaModelos = modelos.reduce((suma, item) => suma + item.ventas, 0);
  const rango =
    datos?.ciclo && datos?.vista ? `${datos.ciclo.inicioTexto} – ${datos.vista.datosTexto}` : "";
  const anteriores = (datos?.archivos || []).filter((archivo) => archivo.dia !== datos?.vista?.dia);

  return (
    <section>
      <div className="encabezado">
        <div>
          <h1>Ventas</h1>
          <p className="ciclo">
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
            <>
              <div className="reporte-actual">
                <div>
                  <p className="sub">Total {conteos.registros} registros.</p>
                  <p className="sub">
                    Abre el libro de este reporte, del {datos.ciclo.inicioTexto} al {datos.vista.datosTexto}, en el navegador.
                  </p>
                </div>
                <div className="reporte-acciones">
                  <button type="button" className="btn secundario" onClick={() => setConsultaAbierta(true)}>
                    Consultar código
                  </button>
                  <button type="button" className="btn secundario" onClick={() => setVersiones((abierto) => !abierto)}>
                    {versiones ? "Ocultar versiones anteriores" : "Ver versiones anteriores"}
                  </button>
                  <Link className="btn" href={`/ventas/libro?dia=${datos.vista.dia}`}>
                    Abrir el Excel
                  </Link>
                </div>
              </div>
              {versiones ? (
                <div className="versiones">
                  <p className="sub">
                    Estos Excel son de días anteriores del mismo ciclo. El reporte de arriba sigue siendo el actual.
                  </p>
                  {anteriores.length ? (
                    <ul>
                      {anteriores.map((archivo) => (
                        <li key={archivo.dia}>
                          <span>{archivo.texto}</span>
                          <Link href={`/ventas/libro?dia=${archivo.dia}`}>Abrir</Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="sub">Por ahora solo está este Excel.</p>
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <p className="sub">Todavía no hay un archivo de este ciclo.</p>
          )}
        </article>
      ) : null}
      {conteos ? (
        <>
          {cruce ? (
            <Cruce
              titulo={`Vendedores TECNO y mercado · ${rango}`}
              nota="Cada barra es un grupo. TECNO es Area Sales Manager y el mercado es el resto. Dentro de la barra, el azul oscuro es la clave y el azul claro es el MIX. El largo es la parte de ese grupo en el reporte."
              grupos={cruce}
              total={conteos.registros}
            />
          ) : (
            <article className="panel bloque">
              <h2>Vendedores TECNO y mercado · {rango}</h2>
              <p className="sub">Esa columna no está en el archivo.</p>
            </article>
          )}
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
          <article className="panel bloque">
            <h2>Top 10 vendedores fijos · {rango}</h2>
            <p className="sub explicacion">
              {fijos.length
                ? `Los 10 con más ventas de la hoja Fijos. Sumados, los vendedores fijos tienen ${conteos.ventasFijos} ventas. El porcentaje es sobre ese total.`
                : "Esos vendedores no aparecen en este archivo."}
            </p>
            {fijos.length ? <Barras items={fijos} base={conteos.ventasFijos} ancha /> : null}
          </article>
          <div className="dos-conteos">
            <article className="panel">
              <h2>Ranking de modelos · {rango}</h2>
              <p className="sub explicacion">
                {modelos.length
                  ? `Están los ${modelos.length} modelos. Sumados dan ${sumaModelos} registros. El porcentaje es sobre ese total. Azul oscuro es clave, LK7 y LK7K. Azul claro es el MIX.`
                  : "Sin registros."}
              </p>
              {modelos.length ? (
                <Barras items={modelos} colorDe={(nombre) => (esClave(nombre) ? COLOR_CLAVE : COLOR_MIX)} />
              ) : null}
            </article>
            <article className="panel">
              <h2>Departamentos · {rango}</h2>
              <p className="sub explicacion">
                El departamento de la venta en DCR: La Paz, Cochabamba, Santa Cruz y el resto. El Alto entra en La Paz, igual que en el Excel. El porcentaje es sobre el total del reporte.
              </p>
              {departamentos.length ? <Barras items={departamentos} /> : <p className="sub">Sin registros.</p>}
            </article>
          </div>
          {pronostico ? (
            <article className="panel bloque">
              <h2>Pronóstico de ventas al {datos.ciclo.finTexto}</h2>
              <p className="sub explicacion">
                Ritmo de los {pronostico.corridos} días ya corridos, llevado a los {pronostico.cicloDias} días del ciclo. Si el ritmo cambia, la proyección cambia.
              </p>
              <div className="corte-leyenda">
                <span>
                  <i style={{ background: COLOR_CLAVE }} />
                  Clave {pronostico.clave} ahora · {pronostico.claveProyectada} al cierre
                </span>
                <span>
                  <i style={{ background: COLOR_MIX }} />
                  MIX {pronostico.mix} ahora · {pronostico.mixProyectada} al cierre
                </span>
              </div>
            </article>
          ) : null}
        </>
      ) : null}
      {consultaAbierta ? (
        <div className="velo" onClick={() => setConsultaAbierta(false)}>
          <div className="consulta" role="dialog" aria-modal="true" aria-labelledby="consulta-titulo" onClick={(evento) => evento.stopPropagation()}>
            <div className="consulta-cabeza">
              <h2 id="consulta-titulo">Consultar código</h2>
              <button type="button" className="btn secundario" onClick={() => setConsultaAbierta(false)}>
                Cerrar
              </button>
            </div>
            <p className="sub explicacion">Busca un código de Fijos o un Uploader ID en el reporte actual.</p>
            <form className="consulta-forma" onSubmit={buscarCodigo}>
              <input
                value={codigoBusqueda}
                onChange={(evento) => setCodigoBusqueda(evento.target.value)}
                placeholder="BOS14102922"
                autoFocus
              />
              <button type="submit" className="btn" disabled={buscandoCodigo || !codigoBusqueda.trim()}>
                {buscandoCodigo ? "Buscando…" : "Buscar"}
              </button>
            </form>
            {errorCodigo ? <p className="aviso fallo">{errorCodigo}</p> : null}
            {consulta && !consulta.encontrado ? <p className="sub">Ese código no está en el reporte.</p> : null}
            {consulta?.encontrado ? (
              <div className="consulta-resultado">
                <p className="consulta-ok">Información encontrada</p>
                <div className="consulta-banner">
                  <strong>
                    Comisión del ciclo
                    {consulta.semana ? ` · semana ${consulta.semana}` : ""}
                  </strong>
                  <span>{consulta.rango}</span>
                </div>
                <dl className="consulta-ficha">
                  <div>
                    <dt>Nombre</dt>
                    <dd>{consulta.nombre || "Sin nombre"}</dd>
                  </div>
                  <div>
                    <dt>Código</dt>
                    <dd>{consulta.codigo}</dd>
                  </div>
                  {consulta.uploaderId ? (
                    <div>
                      <dt>Uploader ID</dt>
                      <dd>{consulta.uploaderId}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Tienda</dt>
                    <dd>{consulta.nombresTienda.length ? consulta.nombresTienda.join(", ") : "Sin tienda"}</dd>
                  </div>
                  <div>
                    <dt>Shop ID</dt>
                    <dd>{consulta.tiendas.length ? consulta.tiendas.join(", ") : "Sin Shop ID"}</dd>
                  </div>
                  <div>
                    <dt>Ciudad</dt>
                    <dd>{consulta.ciudades.length ? consulta.ciudades.join(", ") : "Sin ciudad"}</dd>
                  </div>
                </dl>
                <div className="consulta-corte">
                  <span>
                    <i style={{ background: COLOR_CLAVE }} />
                    Clave {consulta.clave}
                  </span>
                  <span>
                    <i style={{ background: COLOR_MIX }} />
                    MIX {consulta.mix}
                  </span>
                  <strong className="corte-total">Total {consulta.total}</strong>
                </div>
                {consulta.modelos.length ? (
                  <>
                    <table className="lista">
                      <thead>
                        <tr>
                          <th>Modelo</th>
                          <th>Estado</th>
                          <th className="derecha">Ventas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {consulta.modelos.map((fila) => (
                          <tr key={`${fila.modelo}-${fila.estado}`}>
                            <td>{fila.modelo}</td>
                            <td>
                              <span className={fila.estado === "Activado" ? "consulta-estado activado" : "consulta-estado no-activado"}>
                                {fila.estado}
                              </span>
                            </td>
                            <td className="derecha">{fila.ventas}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="sub">
                      {consulta.modelos.length} registro{consulta.modelos.length === 1 ? "" : "s"}
                    </p>
                  </>
                ) : (
                  <p className="sub">Ese código está en Fijos y no tiene ventas en este reporte.</p>
                )}
                <div className="consulta-comision">
                  <span>Comisión total generada</span>
                  {consulta.comisionBs == null ? (
                    <>
                      <strong>—</strong>
                      <p className="sub">Sin comisión en Fijos para este código.</p>
                    </>
                  ) : (
                    <>
                      <strong>
                        {new Intl.NumberFormat("es-BO", {
                          style: "currency",
                          currency: "BOB",
                          minimumFractionDigits: 2,
                        })
                          .format(consulta.comisionBs)
                          .replace("BOB", "Bs")}
                      </strong>
                      <p className="sub">
                        {consulta.comisionFuente === "profit"
                          ? `Desde el PROFIT de Fijos, con ${consulta.tipoCambio ?? 8} Bs por dólar del libro.`
                          : "Sale de Comision Bs. de Fijos del ciclo."}
                      </p>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
