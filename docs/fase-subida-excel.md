# Fase posterior: subida segura de Excel

No implementar hasta pedirlo. El cron (`ventas.yml` `0 13 * * *` UTC) sigue igual.

## Patrón C

1. Usuario sube `.xlsx` (clave de oficina).
2. Staging privado → validar ZIP (`PK`), JSZip con CRC, hojas mínimas: `Data_DCR`, `Detalle_imei2`, `Fijos`, `REPORTE`.
3. Backup de plantilla y día → `ventas/backup/...`.
4. Publicar **los mismos bytes** a `ventas/plantilla/ciclo.xlsx` y al día de hoy (Bolivia).
5. Regenerar el `.json` público (sin IMEI).
6. Escribir `override.json` `{ dia, hash, subido, quien }`.

## Cron / Actualizar

En `reportes/ventas/run.mjs`, antes de `subirDia`: si hay override del día, no pisar ese `.xlsx`/`.json`. La plantilla ya lleva los cambios para el día siguiente.

## Reglas OOXML

- JSZip: `createFolders: false`; no `zip.remove("xl/")`.
- Sin round-trip openpyxl/ExcelJS solo para “guardar de nuevo”.
- Si el libro supera ~4.5 MB: upload directo a Blob con token de corta vida.

## Fuera de alcance hasta pedirlo

API `POST /api/ventas/subir`, UI Subir Excel, `validar-libro.mjs`, cambios a `run.mjs`.
