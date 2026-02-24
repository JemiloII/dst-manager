import dotenv from 'dotenv';

dotenv.config();

export const env = {
  DST_INSTALL_DIR: process.env.DST_INSTALL_DIR || '',
  DST_TEMPLATE_DIR: process.env.DST_TEMPLATE_DIR || '',
  SERVERS_DIR: process.env.SERVERS_DIR || '',
  ADMIN_KUID: process.env.ADMIN_KUID || '',
  ADMIN_USER: process.env.ADMIN_USER || '',
  ADMIN_PASS: process.env.ADMIN_PASS || '',
  BASE_PORT: parseInt(process.env.BASE_PORT || '10000', 10),
  SERVER_HOST: process.env.SERVER_HOST || 'localhost',
  JWT_SECRET: process.env.JWT_SECRET || 'change-me',
  PORT: parseInt(process.env.PORT || '3000', 10),
};
