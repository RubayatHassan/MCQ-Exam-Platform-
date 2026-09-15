import { app } from './app.js';
import { config } from './app/config/index.js';

if (config.env !== 'test') {
  app.listen(config.port, () => console.log(`MCQ API listening on ${config.port}`));
}

export { app };
