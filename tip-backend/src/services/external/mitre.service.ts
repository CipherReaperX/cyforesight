import axios from 'axios';
import { db } from '../../config/database';
import { mitreTactics, mitreTechniques } from '../../models/schema';
import logger from '../../config/logger';

// Official MITRE ATT&CK STIX API
const MITRE_ATTACK_URL = 'https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json';

interface MITREStixObject {
  type: string;
  id: string;
  name?: string;
  description?: string;
  external_references?: Array<{
    source_name: string;
    external_id?: string;
  }>;
  kill_chain_phases?: Array<{
    kill_chain_name: string;
    phase_name: string;
  }>;
}

export async function importAllMITREData() {
  logger.info('🔄 Fetching MITRE ATT&CK data from official API...');

  try {
    // Fetch official MITRE ATT&CK dataset
    const response = await axios.get(MITRE_ATTACK_URL);
    const stixData = response.data;

    if (!stixData.objects) {
      throw new Error('Invalid MITRE data structure');
    }

    let tacticsImported = 0;
    let techniquesImported = 0;

    // Extract tactics (x-mitre-tactic)
    const tactics = stixData.objects.filter((obj: MITREStixObject) => obj.type === 'x-mitre-tactic');
    
    logger.info(`📊 Found ${tactics.length} tactics`);

    for (const tactic of tactics) {
      const tacticId = tactic.external_references?.find(
        (ref: { source_name: string; external_id?: string }) => ref.source_name === 'mitre-attack'
      )?.external_id;
      
      if (tacticId && tactic.name) {
        await db.insert(mitreTactics).values({
          tacticId,
          name: tactic.name,
          description: tactic.description || '',
        }).onConflictDoNothing();
        
        tacticsImported++;
      }
    }

    logger.info(`✅ Imported ${tacticsImported} MITRE Tactics`);

    // Extract techniques (attack-pattern)
    const techniques = stixData.objects.filter((obj: MITREStixObject) => 
      obj.type === 'attack-pattern' && !obj.id.includes('revoked')
    );

    logger.info(`📊 Found ${techniques.length} techniques`);

    for (const technique of techniques) {
      const techniqueId = technique.external_references?.find(
        (ref: { source_name: string; external_id?: string }) => ref.source_name === 'mitre-attack'
      )?.external_id;
      
      if (techniqueId && technique.name) {
        await db.insert(mitreTechniques).values({
          techniqueId,
          name: technique.name,
          description: technique.description || '',
        }).onConflictDoNothing();
        
        techniquesImported++;
      }
    }

    logger.info(`✅ Imported ${techniquesImported} MITRE Techniques`);
    logger.info('🎉 MITRE ATT&CK import complete!');

    return {
      tactics: tacticsImported,
      techniques: techniquesImported,
    };

  } catch (error: any) {
    logger.error('❌ MITRE import failed:', error.message);
    throw error;
  }
}

// Auto-update MITRE data (run monthly)
export async function updateMITREData() {
  logger.info('🔄 Checking for MITRE ATT&CK updates...');
  
  try {
    // Check if we need to update (once per month)
    const existingTactics = await db.select().from(mitreTactics).limit(1);
    
    if (existingTactics.length === 0) {
      // First time - import all
      await importAllMITREData();
    } else {
      // Already have data - could add update logic here
      logger.info('⏭️  MITRE data already exists');
    }
  } catch (error: any) {
    logger.error('MITRE update error:', error.message);
  }
}
