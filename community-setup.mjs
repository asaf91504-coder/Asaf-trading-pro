// A candle interval describes the chart; a holding period describes the idea.
export const setupIntervalNames = Object.freeze({
  '15min': '15 דקות', '1h': 'שעה', '1day': 'יומי', '1week': 'שבועי'
});
export const holdingPeriodNames = Object.freeze({
  unspecified: 'לא צוין', days: 'כמה ימים', weeks: 'כמה שבועות',
  months: 'כמה חודשים', long_term: 'טווח ארוך'
});
export function setupInterval(value) {
  if (typeof value !== 'string') return null;
  const normalized = value === '1hour' ? '1h' : value;
  return Object.hasOwn(setupIntervalNames, normalized) ? normalized : null;
}
export function setupHoldingPeriod(value) {
  if (value === undefined || value === null || value === '') return 'unspecified';
  if (typeof value !== 'string') return null;
  return Object.hasOwn(holdingPeriodNames, value) ? value : null;
}

export function openSetupChart(setup, {document, EventClass = Event}) {
  const interval = setupInterval(setup.interval);
  const select = document.getElementById('marketInterval');
  if (!interval || !Array.from(select.options).some(option => option.value === interval)) {
    throw Error('טווח הנרות של הסטאפ אינו נתמך. הגרף לא שונה.');
  }
  if (document.getElementById('marketFetch').disabled) {
    throw Error('נתוני גרף נטענים כרגע. המתן לסיום ולחץ שוב על פתח גרף.');
  }
  const symbol = document.getElementById('symbol');
  const intervalChanged = select.value !== interval;
  const symbolChanged = symbol.value !== setup.symbol;
  symbol.value = setup.symbol;
  select.value = interval;
  // Clear old candles and pending analysis before starting the requested load.
  // Reopening the same selection must retain its data during refresh cooldown.
  if (intervalChanged) select.dispatchEvent(new EventClass('change'));
  if (symbolChanged) symbol.dispatchEvent(new EventClass('input'));
  document.querySelector('[data-tab="charts"]').click();
  document.getElementById('loadChart').click();
}
