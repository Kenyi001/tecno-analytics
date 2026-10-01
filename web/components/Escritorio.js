"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { REPORTES } from "../lib/reportes";

export default function Escritorio({ children }) {
  const pathname = usePathname();
  const titulo = pathname.startsWith("/ventas/libro")
    ? "Libro"
    : pathname.startsWith("/ventas")
      ? "Ventas"
      : pathname.startsWith("/cobertura")
        ? "Cobertura"
        : "Inicio";

  return (
    <div className="desk">
      <header className="barra">
        <Link href="/" className="marca">
          tecno-analytics
        </Link>
        <span className="migas">{titulo}</span>
      </header>
      <div className="cuerpo">
        <aside className="menu">
          <Link href="/" className={pathname === "/" ? "item activo" : "item"}>
            Inicio
          </Link>
          <p className="menu-etiqueta">Reportes</p>
          {REPORTES.map((item) => {
            const activo = pathname === item.ruta || pathname.startsWith(`${item.ruta}/`);
            return (
              <Link key={item.id} href={item.ruta} className={activo ? "item activo" : "item"}>
                {item.nombre}
              </Link>
            );
          })}
        </aside>
        <main className="contenido">{children}</main>
      </div>
    </div>
  );
}
