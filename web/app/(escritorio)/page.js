import Link from "next/link";
import { REPORTES } from "../../lib/reportes";
import { resumenCobertura, resumenVentas } from "../../lib/blob";

export const dynamic = "force-dynamic";

export default async function Inicio() {
  let ventas = null;
  let cobertura = null;
  let fallo = false;
  try {
    [ventas, cobertura] = await Promise.all([resumenVentas(), resumenCobertura()]);
  } catch {
    fallo = true;
  }

  return (
    <section>
      <div className="encabezado">
        <div>
          <h1>Reportes</h1>
          <p className="sub">El escritorio de tecno-analytics. Cada reporte se abre desde aquí.</p>
        </div>
      </div>
      <div className="rejilla-tarjetas">
        {REPORTES.map((reporte) => {
          let estado = "Todavía no hay archivo.";
          if (reporte.id === "ventas") {
            estado = "Todavía no hay archivo. Se actualiza a las 9:00.";
            if (fallo) estado = "No se pudo consultar el archivo.";
            else if (ventas?.vista) {
              estado = `Última actualización ${ventas.vista.actualizadoTexto}. Datos del Excel hasta ${ventas.vista.datosTexto}.`;
            }
          } else if (reporte.id === "cobertura") {
            if (cobertura?.actualizadoTexto) {
              estado = `Última actualización ${cobertura.actualizadoTexto}. Referencia ${cobertura.referenciaTexto}.`;
            } else if (fallo) estado = "No se pudo consultar la cobertura.";
          }
          return (
            <Link key={reporte.id} href={reporte.ruta} className="tarjeta-reporte">
              <span className="punto" />
              <strong>{reporte.nombre}</strong>
              <span className="sub">{reporte.detalle}</span>
              <span className="estado">{estado}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
