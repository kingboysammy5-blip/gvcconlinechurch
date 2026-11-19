import 'dotenv/config';
import { ensureSeeded } from './seed.ts';

async function main() {
  console.log('Seeding GVCC PostgreSQL database...');
  await ensureSeeded();
  console.log('GVCC database seed verified successfully.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Database seed failed:', err);
  process.exit(1);
});
