# IrukaData

IrukaData es una aplicación en desarrollo para gestionar equipos de vóleibol y registrar estadísticas de los jugadores del propio club durante los partidos. Está pensada para acompañar tanto el trabajo de organización de una temporada como el registro rápido desde la cancha.

El proyecto prioriza el funcionamiento local y sin conexión, una interfaz en español y controles adecuados para notebook y tablet. Su objetivo es reunir acciones técnicas, marcador, rotaciones, sustituciones oficiales y reemplazos de líbero en un mismo panel de partido.

**Estado actual:** la aplicación permite configurar un club, gestionar equipos y temporadas y asociarlos con almacenamiento local. El Hito 1 está en desarrollo: los perfiles de deportistas y las inscripciones todavía están pendientes, al igual que los torneos y el registro de partidos.

## Objetivos

- Organizar un club por equipos, categorías, temporadas y competiciones.
- Mantener un perfil único por deportista, con inscripciones y dorsales independientes por equipo y temporada.
- Agilizar el registro en vivo sin cambiar de pantalla para anotar acciones, puntos o cambios de jugadores.
- Aplicar reglas de puntuación, rotación y cambios mediante un motor independiente de la interfaz y del almacenamiento.
- Conservar el historial deportivo y ofrecer estadísticas por jugador, equipo, categoría, temporada y torneo.
- Trabajar con datos locales, sin requerir cuentas, nube ni un servidor de negocio.

## Funcionalidades previstas

Las siguientes funcionalidades forman parte del alcance previsto y **todavía no están disponibles como flujos operativos**:

| Área | Alcance previsto |
| --- | --- |
| Jugadores e inscripciones | Perfiles únicos, inscripción en varias categorías y dorsales independientes; conservación del dorsal utilizado en cada partido. |
| Torneos | Competiciones asociadas a equipos y temporadas, con sus partidos e historial de resultados. |
| Partidos y alineación | Convocatorias desde tarjetas de jugadores inscritos, seis titulares por posición, banca y designación de hasta dos líberos según el torneo. |
| Registro en vivo | Secuencias de saque, recepción, ataque, bloqueo, defensa y colocación; resultados terminales que adjudican un único punto por jugada, puntos manuales, deshacer, guardado automático y reanudación. |
| Marcador y rotaciones | Partidos al mejor de tres sets, a 25/25/15 con dos puntos de ventaja; rotación al recuperar el servicio y nueva alineación inicial por set. |
| Sustituciones oficiales | Validación de elegibilidad, límites por set y reingresos según el perfil del torneo, con registro de entradas y salidas. |
| Reemplazos de líbero | Registro separado de las sustituciones oficiales, vínculo con el jugador regular reemplazado y control de la ocupación de cancha sin alterar el orden reglamentario. |
| Estadísticas e historial | Métricas individuales y de equipo derivadas de las acciones registradas, con filtros por partido, set, torneo, categoría y temporada. |
| Respaldos | Exportación e importación de los datos locales para recuperar el historial. |

El panel en vivo reunirá las acciones técnicas, los puntos, las sustituciones oficiales y los reemplazos de líbero **sin navegar a otra pantalla**. Los límites y condiciones de los cambios dependerán de las reglas configuradas para cada torneo.

El registro individual se limitará a los jugadores del propio club. El rival se identificará por su nombre, marcador y equipo al servicio, sin estadísticas individuales de sus jugadores.

## Funcionalidades implementadas

- Pantalla de inicio y navegación en español.
- Configuración y edición del nombre de un único club.
- Creación, consulta y edición de equipos masculinos y femeninos en Sub 14, Sub 16, Sub 18, Sub 21 y TC, con búsqueda y filtros por rama, categoría y temporada.
- Creación y edición de temporadas con validación de fechas, y asociación de un equipo a varias temporadas.
- Archivado y restauración de equipos y temporadas conservando sus identidades y asociaciones.
- Demostración estática de solo lectura con nombres y equipos ficticios; sus datos no se insertan en la base del club.
- Estructura modular que separa dominio, estadísticas, aplicación, almacenamiento e interfaz.
- Contratos tipados para identidad, inscripciones, reglas por partido, eventos, cambios y proyecciones estadísticas, junto a un catálogo central de 22 resultados técnicos.
- Almacenamiento Dexie/IndexedDB para club, equipos, temporadas y sus asociaciones, con migración desde la estructura inicial, guardado transaccional y detección de ediciones desactualizadas entre pestañas.
- Manifiesto, iconos y caché PWA para cargar los recursos compilados sin conexión después de su preparación inicial, sin forzar la activación de nuevas versiones durante una sesión abierta.
- Configuración de TypeScript estricto, lint, pruebas unitarias, pruebas de componentes, pruebas de navegador e integración continua.

Los contratos y el catálogo son cimientos técnicos: todavía no existen perfiles editables de deportistas, inscripciones, torneos, un motor reglamentario operativo, registro de puntos, ejecución de cambios, cálculo de estadísticas ni exportación/importación de respaldos.

## Etapas de desarrollo

| Etapa | Objetivo | Estado |
| --- | --- | --- |
| Hito 0 — Especificación y cimientos | Estructura modular, contratos de dominio, catálogo de resultados, datos ficticios y herramientas de desarrollo y pruebas. | Implementado |
| Hito 1 — Club, equipos y perfiles | Gestión de equipos, categorías, temporadas, deportistas e inscripciones con dorsal independiente. Equipos y temporadas disponibles; perfiles e inscripciones pendientes. | En desarrollo |
| Hito 2 — Torneos, partidos y alineación | Competiciones, creación de partidos, convocatoria, seis titulares por posición y designación de líberos. | Planificado |
| Hito 3 — Motor puro de partido | Estados de partido y jugada, puntuación, servicio, rotaciones y cierre de sets y partidos. | Planificado |
| Hito 4 — Panel de anotación en vivo | Interfaz táctil para acciones y puntos, eventos recientes, deshacer, guardado automático y reanudación. | Planificado |
| Hito 5 — Cambios oficiales y reemplazos de líbero | Flujos de cambio dentro del panel, validación de elegibilidad y reingresos, límites configurables y seguimiento del vínculo líbero–jugador regular. | Planificado |
| Hito 6 — Estadísticas, historial y respaldo | Estadísticas derivadas de eventos, filtros, consulta del historial y exportación/importación de respaldos. | Planificado |
| Hito 7 — Calidad y lanzamiento del MVP | Validación de partidos completos offline, accesibilidad táctil, pulsaciones repetidas, recuperación, restauración de respaldos y preparación para uso real. | Planificado |

## Tecnologías

- **Interfaz:** React, TypeScript, Vite, React Router y CSS local.
- **Almacenamiento local:** IndexedDB mediante Dexie.
- **Recursos offline:** PWA mediante `vite-plugin-pwa`.
- **Calidad:** ESLint, Vitest, Testing Library y Playwright.

## Preparación y arranque

Requisitos: Node.js 22.13 o superior y pnpm 11.25.0 (recomendado Node 24 LTS). La primera instalación de dependencias requiere internet; ejecutar la aplicación no utiliza servicios externos.

Para obtener una copia del proyecto:

```powershell
git clone https://github.com/Camilo-hc/IrukaData.git irukadata
```

Desde la carpeta que contiene `irukadata`, ejecutar lo siguiente. Si ya tienes el proyecto local, utiliza esa copia sin volver a clonarlo.

```powershell
cd irukadata
pnpm install --frozen-lockfile
pnpm dev
```

Abrir la dirección que muestra Vite, normalmente `http://127.0.0.1:5173`. No abrir `index.html` directamente con `file://`.

Para comprobar la versión PWA:

```powershell
pnpm build
pnpm preview
```

Abrir `http://127.0.0.1:4173` con acceso a los recursos locales y esperar a que termine la preparación del service worker. Después puede recargarse sin conexión. El modo de desarrollo no instala service worker. La primera carga de un dispositivo nuevo requiere obtener los recursos locales. Vite solo sirve archivos durante desarrollo/previsualización; no existe servidor de negocio ni base de datos remota.

Mantener el mismo navegador, perfil y origen (protocolo, host y puerto): cambiar `localhost` por `127.0.0.1`, o cambiar puerto, crea otro almacenamiento. No se ha habilitado acceso por LAN; instalar en una tablet requerirá preparar un origen HTTPS confiable. La estrategia de distribución al dispositivo real sigue pendiente.

## Verificaciones

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

`pnpm check` ejecuta tipos, lint, unitarias, build y E2E. Los E2E usan la compilación y levantan/cierran su propia previsualización en el puerto 4173; ese puerto debe estar libre. Si Chromium no está descargado pero Chrome está instalado:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
pnpm test:e2e
```

La descarga inicial del navegador de pruebas requiere internet. El build no descarga recursos de red.

## Alcance actual del modo offline

La caché offline disponible cubre los recursos de la aplicación. Después de su preparación inicial, la gestión de equipos y temporadas permite guardar datos y volver a consultarlos sin conexión. La demostración continúa separada de los datos reales del club. El guardado y la recuperación de partidos completos se incorporarán en etapas posteriores.

IndexedDB pertenece al navegador y al dispositivo. Borrar los datos de la aplicación puede eliminar su almacenamiento local; la función de respaldo todavía está planificada. El uso como registro deportivo real deberá esperar a que estén implementados y verificados los flujos de partido y recuperación de datos.
