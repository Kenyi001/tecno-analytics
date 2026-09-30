export default async function Acceso({ searchParams }) {
  const params = await searchParams;
  const mal = params?.error === "1";
  return (
    <form className="acceso" method="post" action="/api/acceso">
      <h1>Ventas del ciclo</h1>
      <p className="sub">La grilla es de la oficina. El archivo descargado trae el detalle completo.</p>
      <label htmlFor="clave">Clave de oficina</label>
      <input id="clave" name="clave" type="password" autoComplete="current-password" required />
      {mal ? <p className="error">Esa clave no abre la página.</p> : null}
      <button type="submit">Entrar</button>
    </form>
  );
}
