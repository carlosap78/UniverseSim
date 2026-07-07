# UniverseSim

Simulacion 3D de la Via Lactea y de una caida de manzana cerca de la Tierra desde el marco del sistema solar.

## Objetivo fisico

La visualizacion separa tres ideas que suelen mezclarse:

- **Marco solar:** el sistema solar queda fijo como origen y la galaxia se muestra desplazada respecto a ese marco.
- **Curvatura:** la Tierra modifica la geometria efectiva; la manzana sigue una trayectoria natural o geodesica hacia menor radio.
- **Caida local:** cerca de la superficie, un marco que cae con la manzana ve a la manzana casi sin aceleracion propia. En ese marco la manzana queda casi inerte y el piso de la Tierra sube con aceleracion propia de ~9.8 m/s².

La malla 3D no pretende ser un calculo numerico de la metrica de Schwarzschild. Es un modelo visual pedagógico para mostrar curvatura, linea de mundo, aceleracion propia y equivalencia local.

## Que significa que la Tierra se acelera

En relatividad general, una particula en caida libre sigue una geodesica y su acelerometro marca casi `0`. La manzana idealizada hace eso. El suelo no puede seguir esa geodesica porque la materia de la Tierra se sostiene por fuerzas electromagneticas e internas; esas fuerzas empujan cada punto de la superficie hacia afuera de la trayectoria de caida libre.

Por eso un acelerometro apoyado en el piso marca `9.8 m/s²`: es la aceleracion propia del piso. En el marco local que cae con la manzana, esa aceleracion se ve como el piso subiendo hasta chocar con la manzana. No es una velocidad absoluta de toda la Tierra por el espacio; es una descripcion local de la superficie desviandose de la geodesica que seguiria si no estuviera sostenida.

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
