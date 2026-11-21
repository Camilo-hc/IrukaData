# IrukaData

Aplicación local de vóleibol en español. **Entrega: únicamente Hito 0.**

## Preparación y arranque

Requisitos: Node.js 22.13 o superior y pnpm 11.25.0 (recomendado Node 24 LTS). La primera instalación de dependencias requiere internet; ejecutar la aplicación no utiliza servicios externos.

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

## Contenido y límites

- React, TypeScript estricto, Vite, Router, CSS local, lint, Vitest, Testing Library y Playwright.
- Inicio en español y demostración estática de solo lectura, sin inserción en la base de datos.
- Contratos para identidad, inscripciones, reglas por partido, eventos, cambios y proyecciones estadísticas.
- Catálogo central de los 22 resultados técnicos previstos.
- Adaptador Dexie/IndexedDB con versión inicial y comprobación de disponibilidad; solo tabla de metadatos.
- Manifiesto e iconos PWA, caché local de recursos y activación diferida de nuevas versiones.

No hay CRUD, partidos operativos, motor reglamentario, registro de puntos, cambios, cálculos estadísticos ni respaldos todavía. Los contratos preparan esas funciones; no acreditan su implementación.
