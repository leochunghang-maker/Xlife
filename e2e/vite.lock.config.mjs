import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const mock=new URL('./native-lock-mock.js',import.meta.url).pathname;
export default defineConfig({plugins:[react()],resolve:{alias:[
 {find:/^@capacitor\/core$/,replacement:mock},
 {find:/^@capacitor\/app$/,replacement:mock},
 {find:/^@capgo\/capacitor-native-biometric$/,replacement:mock},
]}});
