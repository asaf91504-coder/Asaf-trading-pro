"""Import a saved public Twelve Data US common-stock reference response.
Usage: python scripts/import-us-stock-directory.py input.json YYYY-MM-DD
No API keys or quote requests are used.
"""
import json,collections,re,sys,datetime
from pathlib import Path
obj=json.loads(Path(sys.argv[1]).read_text())
retrieved=str(datetime.date.fromisoformat(sys.argv[2]))
if obj.get('status')!='ok' or not isinstance(obj.get('data'),list):raise ValueError('Invalid reference response')
rows={}
for r in obj['data']:
 s=r['symbol']
 if r.get('country')!='United States' or r.get('currency')!='USD' or r.get('type')!='Common Stock' or not re.fullmatch(r'[A-Z0-9][A-Z0-9._-]{0,19}',s):continue
 priority={'NASDAQ':0,'NYSE':0,'IEX':1,'CBOE':1,'OTC':2}
 if r.get('exchange') not in priority:continue
 if s not in rows or priority[r['exchange']]<priority[rows[s]['exchange']]:rows[s]=r
ordered=sorted(rows.values(),key=lambda r:({'NASDAQ':0,'NYSE':0,'IEX':1,'CBOE':1,'OTC':2}[r['exchange']],r['symbol']))
meta={'source':'https://api.twelvedata.com/stocks?country=United%20States&type=Common%20Stock','retrievedAt':retrieved,'instrumentType':'Common Stock','country':'United States','currency':'USD','count':len(ordered),'exchanges':dict(collections.Counter(r['exchange'] for r in ordered)),'basis':'Provider reference directory only; listing is not proof of active trading, entitlement, sufficient history or verified market cap.'}
if len(ordered)<10000:raise ValueError('Insufficient unique US common stock symbols')
root=Path(__file__).resolve().parents[1]
(root/'server/us-stock-directory.mjs').write_text('// Public provider reference directory: symbols only, no quotes or credentials.\nexport const usStockDirectoryMetadata='+json.dumps(meta,separators=(',',':'))+';\nexport const usStockDirectory='+json.dumps([r['symbol'] for r in ordered],separators=(',',':'))+';\n')
print(meta)
