# Poland Salary Calculator

A Russian-language, browser-based calculator that estimates take-home pay in Poland for 2026. It is a static website with no build step or package dependencies.

## Run

Open `index.html` in a modern browser. To serve it locally instead, run:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>. The page loads the Onest font from Google Fonts when an internet connection is available and falls back to system fonts otherwise.

## What it calculates

- Employment income under umowa o pracę, umowa zlecenie, and umowa o dzieło.
- B2B/JDG income using liniowy, ryczałt, or skala taxation, with selectable ryczałt rates.
- Monthly and annual estimates, including ZUS, health contributions, income tax, and employer costs where applicable.
- Common settings and reliefs such as PIT-2, ulga na powrót, ulga dla młodych, student status, PPK, and author-related tax-deductible costs.
- An income breakdown and, for employment contracts, a month-by-month estimate.

Inputs are saved in the browser's local storage. The layout adapts to mobile screens, and its colors follow the system light/dark preference.

## Calculation assumptions

The calculator uses the 2026 parameters shown on the page, including the 30,000 zł tax-free allowance, PIT thresholds of 120,000 zł, and the stated ZUS and health contribution limits. B2B estimates assume equal monthly revenue and expenses over the selected period. Some individual circumstances and contribution options are not modeled, including Mały ZUS Plus and combining B2B with employment.

Results are estimates, not tax or accounting advice. Actual amounts depend on individual circumstances and applicable rules; consult an accountant for decisions or filing.
