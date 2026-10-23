// Activation template, not a deployed function. Copy to netlify/functions only
// after subscription, license flags, quotas, and hosting spending controls are approved.
import {runMarketCycle} from '../../server/background-jobs.mjs';
export default async()=>{await runMarketCycle();return new Response(null,{status:204})};
export const config={schedule:'*/15 * * * *'};
