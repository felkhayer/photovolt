const form = typeof document !== 'undefined' ? document.getElementById('pv-form') : null;
const resultEl = typeof document !== 'undefined' ? document.getElementById('result') : null;
const alertEl = typeof document !== 'undefined' ? document.getElementById('alert') : null;

const nfCurrency = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const nfNumber = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const nfPercent = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

function safeDivide(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return { status: 'invalid', value: null };
  }
  if (Math.abs(denominator) < 1e-9) {
    return { status: 'not_calculable', value: null };
  }
  return { status: 'ok', value: numerator / denominator };
}

function readNumber(formData, fieldName) {
  const raw = formData.get(fieldName);
  return Number(raw);
}

function validateInputs(inputs) {
  const rules = {
    power: { min: 0.1, label: "Puissance de l'installation" },
    pricePerKw: { min: 1, label: "Coût d'installation par kWc" },
    tariff: { min: 0, label: 'Tarif de rachat' },
    production: { min: 1, label: 'Production annuelle moyenne' },
    surface: { min: 0.1, label: 'Surface nécessaire' },
    years: { min: 1, label: "Horizon d'étude" },
    degradationRate: { min: 0, label: 'Dégradation annuelle' },
    omCostPercent: { min: 0, label: 'Coût O&M' },
    discountRate: { min: 0, label: "Taux d'actualisation" },
    inverterYear: { min: 1, label: 'Année remplacement onduleur' },
    inverterCost: { min: 0, label: 'Coût remplacement onduleur' }
  };

  const errors = [];
  Object.entries(rules).forEach(([key, rule]) => {
    const value = inputs[key];
    if (!Number.isFinite(value)) {
      errors.push(`${rule.label} est invalide.`);
      return;
    }
    if (value < rule.min) {
      errors.push(`${rule.label} doit être ≥ ${rule.min}.`);
    }
  });

  if (!Number.isInteger(inputs.years)) {
    errors.push("L'horizon d'étude doit être un entier.");
  }
  if (!Number.isInteger(inputs.inverterYear)) {
    errors.push("L'année de remplacement de l'onduleur doit être un entier.");
  }
  if (inputs.inverterYear > inputs.years) {
    errors.push("L'année de remplacement de l'onduleur doit être dans l'horizon d'étude.");
  }

  return errors;
}

function computeScenario(inputs) {
  const capex = inputs.power * inputs.pricePerKw;
  const annualOM = capex * (inputs.omCostPercent / 100);
  const totalSurface = inputs.power * inputs.surface;

  const yearly = [];
  let cumulative = -capex;
  let discountedCumulative = -capex;

  for (let year = 1; year <= inputs.years; year += 1) {
    const productionFactor = (1 - inputs.degradationRate / 100) ** (year - 1);
    const tariffFactor = (1 + inputs.tariffGrowthRate / 100) ** (year - 1);

    const energy = inputs.power * inputs.production * productionFactor;
    const tariff = inputs.tariff * tariffFactor;
    const revenue = energy * tariff;
    const inverter = year === inputs.inverterYear ? inputs.inverterCost : 0;
    const netCashflow = revenue - annualOM - inverter;

    cumulative += netCashflow;
    const discounted = netCashflow / ((1 + inputs.discountRate / 100) ** year);
    discountedCumulative += discounted;

    yearly.push({ year, energy, tariff, revenue, annualOM, inverter, netCashflow, cumulative, discounted, discountedCumulative });
  }

  const annualRevenueYear1 = yearly[0]?.revenue ?? 0;
  const simplePayback = safeDivide(capex, annualRevenueYear1 - annualOM);
  const roi = safeDivide(annualRevenueYear1 - annualOM, capex);

  const npv = -capex + yearly.reduce((sum, y) => sum + y.discounted, 0);
  const cashflows = [-capex, ...yearly.map((y) => y.netCashflow)];
  const irr = estimateIRR(cashflows);

  let discountedPayback = null;
  for (const y of yearly) {
    if (y.discountedCumulative >= 0) {
      discountedPayback = y.year;
      break;
    }
  }

  return {
    capex,
    totalSurface,
    annualRevenueYear1,
    annualNetYear1: annualRevenueYear1 - annualOM,
    totalRevenue: yearly.reduce((sum, y) => sum + y.revenue, 0),
    netProfit: yearly[yearly.length - 1]?.cumulative ?? -capex,
    npv,
    irr,
    simplePayback,
    discountedPayback,
    yearly
  };
}

function estimateIRR(cashflows) {
  let rate = 0.08;
  for (let i = 0; i < 100; i += 1) {
    let npv = 0;
    let dNpv = 0;
    for (let t = 0; t < cashflows.length; t += 1) {
      npv += cashflows[t] / (1 + rate) ** t;
      if (t > 0) {
        dNpv += -t * cashflows[t] / (1 + rate) ** (t + 1);
      }
    }
    if (Math.abs(npv) < 1e-7) return rate;
    if (Math.abs(dNpv) < 1e-12) return null;
    rate -= npv / dNpv;
    if (!Number.isFinite(rate) || rate <= -0.99 || rate > 10) return null;
  }
  return null;
}

function setInputValidity(errorFields = []) {
  if (typeof document === 'undefined') return;
  const ids = [
    'power', 'pricePerKw', 'tariff', 'production', 'surface', 'years',
    'degradationRate', 'omCostPercent', 'tariffGrowthRate', 'discountRate', 'inverterYear', 'inverterCost'
  ];

  ids.forEach((id) => {
    const input = document.getElementById(id);
    const hasError = errorFields.includes(id);
    input.setAttribute('aria-invalid', String(hasError));
  });
}

function renderErrors(messages) {
  if (!alertEl) return;
  alertEl.className = 'alert error';
  alertEl.innerHTML = `<strong>Veuillez corriger les points suivants :</strong><ul>${messages.map((m) => `<li>${m}</li>`).join('')}</ul>`;
}

function clearErrors() {
  if (!alertEl) return;
  alertEl.className = 'alert';
  alertEl.textContent = '';
}

function formatRatio(ratioObj, asPercent = false) {
  if (ratioObj.status !== 'ok') {
    return 'Non calculable';
  }
  return asPercent ? `${nfPercent.format(ratioObj.value * 100)} %` : nfNumber.format(ratioObj.value);
}

function renderResults(data) {
  if (!resultEl) return;
  const yearlyRows = data.yearly.slice(0, 5).map((y) => `
    <tr>
      <td>Année ${y.year}</td>
      <td>${nfNumber.format(y.energy)}</td>
      <td>${nfCurrency.format(y.revenue)}</td>
      <td>${nfCurrency.format(y.annualOM + y.inverter)}</td>
      <td>${nfCurrency.format(y.netCashflow)}</td>
      <td>${nfCurrency.format(y.cumulative)}</td>
    </tr>
  `).join('');

  resultEl.innerHTML = `
    <div class="cards">
      <article class="card"><h3>CAPEX initial</h3><p>${nfCurrency.format(data.capex)}</p></article>
      <article class="card"><h3>Revenu net année 1</h3><p>${nfCurrency.format(data.annualNetYear1)}</p></article>
      <article class="card"><h3>ROI année 1</h3><p>${formatRatio(data.roi, true)}</p></article>
      <article class="card"><h3>Retour simple</h3><p>${formatRatio(data.simplePayback)} ans</p></article>
      <article class="card"><h3>Retour actualisé</h3><p>${data.discountedPayback ?? 'Non atteint'}</p></article>
      <article class="card"><h3>VAN (NPV)</h3><p>${nfCurrency.format(data.npv)}</p></article>
      <article class="card"><h3>TRI (IRR)</h3><p>${data.irr === null ? 'Non calculable' : `${nfPercent.format(data.irr * 100)} %`}</p></article>
      <article class="card"><h3>Surface requise</h3><p>${nfNumber.format(data.totalSurface)} m²</p></article>
      <article class="card"><h3>Revenus cumulés</h3><p>${nfCurrency.format(data.totalRevenue)}</p></article>
      <article class="card"><h3>Bénéfice net fin horizon</h3><p>${nfCurrency.format(data.netProfit)}</p></article>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Période</th><th>Production (kWh)</th><th>Revenu</th><th>Charges</th><th>Flux net</th><th>Cumul</th>
          </tr>
        </thead>
        <tbody>${yearlyRows}</tbody>
      </table>
    </div>
    <p><em>Aperçu des 5 premières années. Les calculs complets portent sur ${data.yearly.length} ans.</em></p>
  `;
}

if (form) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearErrors();

  const formData = new FormData(form);
  const inputs = {
    power: readNumber(formData, 'power'),
    pricePerKw: readNumber(formData, 'pricePerKw'),
    tariff: readNumber(formData, 'tariff'),
    production: readNumber(formData, 'production'),
    surface: readNumber(formData, 'surface'),
    years: readNumber(formData, 'years'),
    degradationRate: readNumber(formData, 'degradationRate'),
    omCostPercent: readNumber(formData, 'omCostPercent'),
    tariffGrowthRate: readNumber(formData, 'tariffGrowthRate'),
    discountRate: readNumber(formData, 'discountRate'),
    inverterYear: readNumber(formData, 'inverterYear'),
    inverterCost: readNumber(formData, 'inverterCost')
  };

    const validationErrors = validateInputs(inputs);
    if (validationErrors.length > 0) {
      setInputValidity(Object.keys(inputs));
      renderErrors(validationErrors);
      if (resultEl) resultEl.innerHTML = '';
      return;
    }

    setInputValidity([]);
    const data = computeScenario(inputs);
    renderResults(data);
  });
}

export { safeDivide, validateInputs, computeScenario, estimateIRR };
