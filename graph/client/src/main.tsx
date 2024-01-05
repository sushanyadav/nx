import { StrictMode } from 'react';
import { inspect } from '@xstate/inspect';
import { App } from './app/app';
import { ExternalApiImpl } from './app/external-api-impl';
import { render } from 'preact';
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';
import 'highlight.js/styles/github-dark.css';

if (window.useXstateInspect === true) {
  inspect({
    url: 'https://stately.ai/viz?inspect',
    iframe: false, // open in new window
  });
}

window.externalApi = new ExternalApiImpl();
const container = document.getElementById('app');

hljs.registerLanguage('json', json);

if (!window.appConfig) {
  render(
    <p>
      No environment could be found. Please run{' '}
      <pre>npx nx run graph-client:generate-dev-environment-js</pre>.
    </p>,
    container
  );
} else {
  render(
    <StrictMode>
      <App />
    </StrictMode>,
    container
  );
}
