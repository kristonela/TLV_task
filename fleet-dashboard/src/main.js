/**
 * @file main.js
 * @description Application entry point.
 *
 * Creates the Vue 3 app, mounts global styles, and attaches the root component
 * to the `#app` div defined in index.html.
 */

import { createApp } from 'vue'
import App from './App.vue'
import './app.css'

createApp(App).mount('#app')
