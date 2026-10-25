// Session-only history. Switching datasets clears history; backups store current drawings only.
export function drawingHistory(initial=[],limit=40){
 let present=structuredClone(initial),past=[],future=[];
 const copy=()=>structuredClone(present);
 return {value:copy,canUndo:()=>past.length>0,canRedo:()=>future.length>0,
 commit(next){if(JSON.stringify(next)===JSON.stringify(present))return copy();past.push(copy());past=past.slice(-limit);present=structuredClone(next);future=[];return copy()},
 undo(){if(past.length){future.push(copy());present=past.pop()}return copy()},
 redo(){if(future.length){past.push(copy());present=future.pop()}return copy()},
 reset(next=[]){present=structuredClone(next);past=[];future=[];return copy()}};
}
