# UniverseSim Tidal Fall Lab

Laboratorio 3D para estudiar una manzana en caída libre con objetos distribuidos arriba, abajo, izquierda y derecha. El foco es observar cómo se separan aunque todos caen bajo el mismo campo gravitatorio.

## Objetivo fisico

La escena muestra una manzana como referencia y cuatro vecinos:

- objeto arriba de la manzana
- objeto abajo de la manzana
- objeto a la izquierda
- objeto a la derecha

Todos empiezan con la misma velocidad inicial de caída. Al caer, sus posiciones no evolucionan igual porque el campo gravitatorio cambia con la distancia a la masa central. Esa diferencia es el efecto tidal o desviación geodésica:

- el vecino de abajo está más cerca de la masa y acelera más
- el vecino de arriba está más lejos y acelera menos
- los vecinos laterales tienden a comprimirse hacia el eje radial
- la manzana sirve como marco de referencia local para ver la separación relativa

La vista `Separación` sigue a la manzana para que el cambio relativo sea más claro.

## Formulas usadas

La simulacion usa una aproximacion de campo debil, util para explicar visualmente la relacion entre gravedad newtoniana y relatividad general:

```txt
a(r) = -mu r / |r|^3
xi = r_vecino - r_manzana
Delta a = a_vecino - a_manzana
Delta a ≈ T xi, con T_ij = ∂g_i/∂x_j
```

`mu` aumenta con el control de masa central. La curvatura visual es pedagogica: no es un integrador completo de geodesicas en Schwarzschild, pero conecta caída libre, separación relativa y tensor tidal en una sola vista.

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

El smoke test abre la simulacion, cambia entre vistas, guarda capturas en `artifacts/`, revisa que el canvas no este en negro y comprueba que los paneles no se encimen en movil.
