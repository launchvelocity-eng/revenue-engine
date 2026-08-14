import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Resend } from 'resend';
import pkg from 'pg';
import crypto from 'crypto';
import cron from 'node-cron'; // <--- Make sure this is here!
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

const { Pool } = pkg;
const app = express();
