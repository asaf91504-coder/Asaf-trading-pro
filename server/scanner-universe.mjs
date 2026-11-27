import {indexStocks} from '../index-stock-catalogue.mjs';
import {usStockDirectory} from './us-stock-directory.mjs';

export const MAX_SCANNER_SYMBOLS=10000;
export const SHARED_SCANNER_PAGE_SIZE=100;
const valid=s=>/^[A-Z0-9][A-Z0-9._-]{0,19}$/.test(s);
export function scannerUniverse(env={}, {legacy=false}={}){
 const configured=[...new Set((env.ASAF_MARKET_ALLOWED_SYMBOLS||'').split(',').map(s=>s.trim().toUpperCase()).filter(Boolean))];
 if(configured.length>MAX_SCANNER_SYMBOLS||configured.some(s=>!valid(s)))return [];
 if(!env.ASAF_SCANNER_UNIVERSE)return configured;
 if(!['us1000','us10000'].includes(env.ASAF_SCANNER_UNIVERSE))return [];
 // Reuse the dated US-listings catalogue. These are candidates for screening,
 // not a claim of current index membership, liquidity or provider entitlement.
 const candidates=[...configured,...indexStocks.filter(s=>s.groups.includes('sp500')).map(s=>s.symbol),...indexStocks.map(s=>s.symbol)];
 // Preserve the previous 1,000-symbol ordering, then expand with provider
 // reference symbols. Unknown coverage never bypasses the actual data gates.
 const previous=[...new Set(candidates.filter(valid))].slice(0,1000);
 // Existing deployed us1000 presets upgrade in code; no secret/environment
 // changes are required. legacy is used only to find the prior cache namespace.
 return legacy?previous:[...new Set([...previous,...usStockDirectory])].slice(0,MAX_SCANNER_SYMBOLS);
}
