import serverless from 'serverless-http';
import { app } from '../../server.ts';

const serverlessApp = serverless(app);

export const handler = async (event: any, context: any) => {
  if (typeof event?.path === 'string' && event.path.startsWith('/.netlify/functions/api')) {
    const suffix = event.path.slice('/.netlify/functions/api'.length);
    event.path = suffix.startsWith('/api')
      ? suffix
      : `/api${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
  }

  if (typeof event?.rawUrl === 'string' && event.rawUrl.includes('/.netlify/functions/api')) {
    event.rawUrl = event.rawUrl
      .replace('/.netlify/functions/api', '/api')
      .replace('/api/api', '/api');
  }

  return serverlessApp(event, context);
};
