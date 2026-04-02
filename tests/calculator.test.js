import assert from 'node:assert/strict';
import { safeDivide, validateInputs, computeScenario, estimateIRR } from '../calculator.js';

const validInputs = {
  power: 36,
  pricePerKw: 1500,
  tariff: 0.1318,
  production: 1200,
  surface: 7,
  years: 25,
  degradationRate: 0.5,
  omCostPercent: 1.0,
  tariffGrowthRate: 0,
  discountRate: 4,
  inverterYear: 12,
  inverterCost: 6000
};

assert.equal(safeDivide(10, 2).status, 'ok');
assert.equal(safeDivide(10, 0).status, 'not_calculable');
assert.equal(safeDivide(NaN, 1).status, 'invalid');

assert.deepEqual(validateInputs(validInputs), []);
assert.ok(validateInputs({ ...validInputs, power: -1 }).length > 0);
assert.ok(validateInputs({ ...validInputs, years: 25.5 }).length > 0);
assert.ok(validateInputs({ ...validInputs, inverterYear: 30 }).length > 0);

const scenario = computeScenario(validInputs);
assert.ok(Number.isFinite(scenario.capex));
assert.ok(Number.isFinite(scenario.npv));
assert.equal(scenario.yearly.length, 25);
assert.ok(scenario.simplePayback.status === 'ok' || scenario.simplePayback.status === 'not_calculable');

const irr = estimateIRR([-1000, 300, 300, 300, 300, 300]);
assert.ok(irr === null || Number.isFinite(irr));

console.log('All calculator tests passed.');
