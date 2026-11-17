// Isolated preview only. Production cannot activate this endpoint even when
// trial flags are inadvertently copied into its environment.
import {createRasterTrialHandler} from '../../server/twelve-raster-trial.mjs';
const handler=createRasterTrialHandler();
export default request=>{
 if(!['deploy-preview','branch-deploy'].includes(process.env.CONTEXT))return new Response(JSON.stringify({error:'Trial chart unavailable'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 return handler(request);
};
