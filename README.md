# photovolt

Simulateur de rentabilité d'installation photovoltaïque.

## Lancer l'application

Ouvrez `index.html` dans un navigateur.

## Hypothèses prises en charge

Le simulateur modélise désormais :

- Dégradation annuelle de production.
- Coût annuel d'exploitation/maintenance (O&M) en % du CAPEX.
- Évolution tarifaire annuelle.
- Taux d'actualisation.
- Remplacement onduleur (année + coût).
- Flux annuel sur un horizon paramétrable (1 à 50 ans).

## Résultats fournis

- CAPEX initial, surface requise.
- Revenu net année 1 et ROI année 1.
- Délai de retour simple.
- Délai de retour actualisé.
- VAN (NPV) et TRI (IRR estimé).
- Revenus cumulés et bénéfice net en fin d'horizon.

## Tests

Prérequis : Node.js 18+.

```bash
npm test
```

Les tests couvrent des cas nominaux et limites (division par zéro, valeurs invalides, horizon non entier, etc.).
