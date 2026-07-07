# UniverseSim

Simulacion 3D de la Via Lactea y de una caida de manzana cerca de la Tierra desde el marco del sistema solar.

## Objetivo fisico

La visualizacion separa tres ideas que suelen mezclarse:

- **Marco solar:** el sistema solar queda fijo como origen y la galaxia se muestra desplazada respecto a ese marco.
- **Curvatura:** la Tierra modifica la geometria efectiva; la manzana sigue una trayectoria natural o geodesica hacia menor radio.
- **Caida local:** cerca de la superficie, un marco que cae con la manzana ve a la manzana casi sin aceleracion propia. El suelo tiene aceleracion propia hacia arriba porque las fuerzas internas de la Tierra impiden que sus puntos sigan geodesicas.

La malla 3D no pretende ser un calculo numerico de la metrica de Schwarzschild. Es un modelo visual pedagógico para mostrar curvatura, linea de mundo, aceleracion propia y equivalencia local.

## Desarrollo

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Verificacion visual

Con el servidor de desarrollo activo:

```bash
npx playwright install chromium
npm run smoke
```

El smoke test abre la simulacion, cambia entre modos, guarda capturas en `artifacts/`, revisa que el canvas no este en negro y comprueba que los paneles no se encimen en movil.
