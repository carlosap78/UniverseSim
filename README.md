# UniverseSim Vector Lab

Laboratorio 3D para estudiar lanzamientos de una manzana y otros objetos alrededor de una masa central. El modelo anterior fue reemplazado por una visualizacion enfocada en vectores, planos de curvatura y formulas interactivas.

## Objetivo fisico

La escena muestra seis objetos lanzados desde la misma region con velocidades iniciales distintas:

- arriba y abajo sobre el eje radial `Y`
- izquierda y derecha sobre el eje tangencial `X`
- adelante y atras sobre el eje `Z`, para comparar otros planos

Cada objeto tiene tres vectores:

- `r`: vector posicion desde el centro de la masa
- `v`: vector velocidad instantanea
- `a`: aceleracion gravitatoria hacia la masa

Las mallas `XZ`, `XY` e `YZ` muestran cortes de la curvatura visual. Las flechas pequenas sobre esas mallas son el campo gravitatorio proyectado en cada plano.

## Formulas usadas

La simulacion usa una aproximacion de campo debil, util para explicar visualmente la relacion entre gravedad newtoniana y relatividad general:

```txt
a(r) = -mu r / |r|^3
Phi(r) = -mu / |r|
ds² ≈ -(1 + 2 Phi/c²)c²dt² + (1 - 2 Phi/c²)dℓ²
```

`mu` aumenta con el control de masa central. La curvatura visual es pedagogica: no es un integrador completo de geodesicas en Schwarzschild, pero conecta trayectorias, vectores y metrica de campo debil en una sola vista.

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
