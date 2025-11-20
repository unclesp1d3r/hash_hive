import pino from 'pino';
import { config } from '../config';

const loggerOptions: pino.LoggerOptions = {
  level: config.logging.level,
};

if (config.logging.pretty) {
  loggerOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  };
}

export const logger = pino(loggerOptions);
