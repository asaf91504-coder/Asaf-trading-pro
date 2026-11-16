// Retired after the owner's completed test. Never call PayPal, including from stale tabs.
export default ()=>Response.json({error:'אפשרות תשלום הבדיקה הוסרה.'},{status:410,headers:{'Cache-Control':'no-store'}});
