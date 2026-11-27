// TEST-ONLY Vite alias; never imported by the production config/bundle.
import { Capacitor as RealCapacitor } from '../node_modules/@capacitor/core/dist/index.js';
export * from '../node_modules/@capacitor/core/dist/index.js';
export const Capacitor = { ...RealCapacitor, isNativePlatform:()=>true, isPluginAvailable:name=>name==='App' || name==='NativeBiometric' && window.__nativeLock.supported!==false };
const state=window.__nativeLock;
state.listeners=new Map();
state.emit=(event,value)=>{for(const fn of state.listeners.get(event)||[])fn(value);};
export const App = {
 async addListener(event,callback) {
  state.added++;if(!state.listeners.has(event)) state.listeners.set(event,new Set());
  state.listeners.get(event).add(callback);
  return {remove:async()=>{state.removed++;state.listeners.get(event).delete(callback);}};
 },
};
export const NativeBiometric = {
 async isAvailable(){return {isAvailable:true,biometryType:2};},
 async verifyIdentity(){
  state.calls++;state.emit('appStateChange',{isActive:false});
  await Promise.resolve();state.emit('appStateChange',{isActive:true});
  if(state.outcome!=='success')throw new Error('synthetic cancel/failure');
 },
};
