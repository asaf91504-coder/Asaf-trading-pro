export const VENTURE_AI_POLICY='\nTWELVE DATA PRESENTATION: Provider OHLCV stays on the server. Never output, reconstruct or export historical raw price/volume series, candle tables, CSV/JSON datasets or bulk quotes, even on request. Give concise derived research, explanations and conditional entry/stop levels only. Chart tools generate a new server-rendered image; never promise browser zoom, pan or raw candle access.';
export function rawMarketExportRequest(message){
 const text=String(message||'');
 return /(?:\b(?:export|download|csv|json|raw data|ohlcv|all (?:the )?(?:prices|candles|bars))\b|(?:ייצא|יצא|הורד|להוריד|לייצא|נתונים גולמיים|כל (?:הנרות|המחירים|הנתונים)))/iu.test(text);
}
