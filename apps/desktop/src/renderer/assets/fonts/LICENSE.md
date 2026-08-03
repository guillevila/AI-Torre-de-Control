# Licencias de las tipografías empaquetadas

Las tres familias incluidas en esta carpeta se distribuyen bajo la
**SIL Open Font License, Version 1.1**, que permite usarlas, incrustarlas y
redistribuirlas —incluso en software comercial— siempre que no se vendan por sí
solas y se conserve el aviso de licencia. Este archivo es ese aviso.

| Familia | Autoría | Origen |
|---|---|---|
| **Instrument Sans** | Rodrigo Fuenzalida, Jordan Egstad | [Instrument](https://github.com/Instrument/instrument-sans) |
| **Instrument Serif** | Rodrigo Fuenzalida, Jordan Egstad | [Instrument](https://github.com/Instrument/instrument-serif) |
| **JetBrains Mono** | JetBrains, Philipp Nurullin, Konstantin Bulenkov | [JetBrains](https://github.com/JetBrains/JetBrainsMono) |

Texto completo de la licencia: <https://openfontlicense.org/>

---

## Por qué están aquí y no se cargan de internet

La aplicación funciona sin conexión (decisión D1) y su política de contenidos en
producción bloquea cualquier petición externa. Cargarlas desde Google Fonts
fallaría y, además, avisaría a un servidor de terceros cada vez que abrieras la
aplicación.

Solo se han incluido los subconjuntos **latin** y **latin-ext**: 190 KB en total
para las tres familias.

## Cómo actualizarlas

No hay proceso automático a propósito: es un archivo que se toca una vez cada
mucho tiempo. Para renovarlas, descarga los `.woff2` de los repositorios de
arriba o de la API de Google Fonts, sustituye los archivos de esta carpeta y
ajusta `fonts.css` si cambian los nombres.
