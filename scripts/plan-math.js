(function (root) {
  const TIME_OPTIONS = {
    'under 1 hour': { hours: 0.5, label: '0.5 hours' },
    '1 to 3 hours': { hours: 2, label: '2 hours' },
    '3 to 6 hours': { hours: 4.5, label: '4.5 hours' },
    'more than 6 hours': { hours: 6, label: '6+ hours' }
  };

  function weeklyTime(value) {
    const result = TIME_OPTIONS[String(value).trim().toLowerCase()];
    if (!result) throw new Error('Unknown weekly time option.');
    return result;
  }

  function savingRange(low, high) {
    if (!Number.isInteger(low) || !Number.isInteger(high)) {
      return { low: 20, high: 40 };
    }
    const normalizedLow = Math.min(40, Math.max(10, low));
    const normalizedHigh = Math.min(60, Math.max(normalizedLow + 1, high));
    return { low: normalizedLow, high: normalizedHigh };
  }

  function formatHours(value, digits = 1) {
    return Number(value.toFixed(digits)).toString();
  }

  function savings(hours, low, high) {
    const range = savingRange(low, high);
    const lowHours = hours * range.low / 100;
    const highHours = hours * range.high / 100;
    let lowText = formatHours(lowHours);
    let highText = formatHours(highHours);
    if (lowText === highText) {
      lowText = formatHours(lowHours, 2);
      highText = formatHours(highHours, 2);
    }
    return {
      low: range.low,
      high: range.high,
      lowHours,
      highHours,
      extraHours: highHours - lowHours,
      remainingHours: Math.max(0, hours - highHours),
      midpointPercent: Math.round((range.low + range.high) / 2),
      annualLow: Math.round(lowHours * 52),
      annualHigh: Math.round(highHours * 52),
      sentence: `Roughly ${lowText} to ${highText} hours a week.`
    };
  }

  function combinedHighHours(hours, recommendations) {
    const total = recommendations.reduce((sum, item) =>
      sum + hours * savingRange(item.saving_percent_low, item.saving_percent_high).high / 100, 0);
    return Number(Math.min(total, hours * 0.6).toFixed(2));
  }

  const api = { weeklyTime, savingRange, formatHours, savings, combinedHighHours };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ZF_PLAN_MATH = api;
})(globalThis);
