export function shouldSendOnEnter(event,touchKeyboard=false){
 return event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&!touchKeyboard;
}
export function isChatNearBottom(log){
 return log.scrollHeight-log.scrollTop-log.clientHeight<=80;
}
