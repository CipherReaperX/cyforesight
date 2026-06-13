import 'dotenv/config';
import { importAllMITREData } from '../src/services/external/mitre.service';

async function run() {
  console.log('🚀 Starting MITRE ATT&CK import...');
  console.log('📡 Fetching from official MITRE GitHub repository...');
  
  try {
    const result = await importAllMITREData();
    
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('✅ MITRE ATT&CK Import Complete!');
    console.log('═══════════════════════════════════════');
    console.log(`📊 Tactics imported: ${result.tactics}`);
    console.log(`📊 Techniques imported: ${result.techniques}`);
    console.log('═══════════════════════════════════════');
    console.log('');
    
  } catch (error: any) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

run();
